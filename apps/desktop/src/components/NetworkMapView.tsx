import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getCityData, subscribeCity } from "../data/cityData";
import { getSelectedId, setSelectedId, subscribeSelection } from "../state/selectionStore";
import { subscribeTimeline, getTimelineState, play, pause, formatMinute, stepForward, stepBackward } from "../state/timelineStore";
import { OASA_GTFS_STOPS_WITH_ROUTES } from "../data/gtfs/oasa-gtfs-stops-with-routes.generated";
import { subscribeInterventions, getAccepted, acceptIntervention, rejectIntervention } from "../state/interventionStore";
import { getSimulationState } from "../simulation/simulationEngine";
import { subscribeLiveTraffic } from "../state/liveTrafficStore";
import { getHopVehicles, getMicromobilityVehicles, resetHopMock, scoreHopAvailability } from "../state/micromobilityLiveStore";
import { getDecisionLog } from "../state/decisionLogStore";
import { getSelectedProposalId, setSelectedProposalId, subscribeProposalSelection } from "../state/proposalSelectionStore";
import { rankInterventionsForDisruption, planInterventionSequence } from "../state/decisionEngine";
import { OASA_GTFS_SHAPES } from "../data/gtfs/oasa-gtfs-shapes.generated";
import { NEA_SMYRNI_BOUNDARY } from "../data/boundaries/nea-smyrni-boundary";
import { ATHENS_MUNICIPALITY_BOUNDARY } from "../data/boundaries/athens-municipality-boundary";
import { THESSALONIKI_MUNICIPALITY_BOUNDARY } from "../data/boundaries/thessaloniki-municipality-boundary";
import {
  subscribeRoadGeometry,
  ensureRoadGeometry,
  getRoadGeometry,
  roadGeometryKey,
} from "../state/roadGeometryStore";
import {
  ATHENS_SEGMENT_RANGES,
  THESSALONIKI_SEGMENT_RANGES,
} from "../data/networkGeometry";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;




function getMunicipalityBoundaryForCity(cityId: string) {
  if (cityId === "nea_smyrni" || cityId === "nea-smyrni") return NEA_SMYRNI_BOUNDARY as any;
  if (cityId === "athens") return ATHENS_MUNICIPALITY_BOUNDARY as any;
  if (cityId === "thessaloniki") return THESSALONIKI_MUNICIPALITY_BOUNDARY as any;
  return null;
}

function getPolygonRingsFromBoundary(boundary: any): any[] {
  const geom = boundary?.features?.[0]?.geometry;
  if (!geom) return [];

  if (geom.type === "Polygon") {
    return geom.coordinates || [];
  }

  if (geom.type === "MultiPolygon") {
    return (geom.coordinates || []).flat();
  }

  return [];
}

function pointInRing(point: [number, number], ring: [number, number][]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

function pointInBoundary(point: any, boundary: any) {
  if (!isValidCoord(point)) return false;
  const rings = getPolygonRingsFromBoundary(boundary);
  return rings.some((ring: any) => pointInRing(point, ring));
}

function featureTouchesBoundary(feature: any, boundary: any) {
  const geom = feature?.geometry;
  if (!geom || !boundary) return true;

  if (geom.type === "Point") {
    return pointInBoundary(geom.coordinates, boundary);
  }

  if (geom.type === "LineString") {
    return (geom.coordinates || []).some((coord: any) => pointInBoundary(coord, boundary));
  }

  if (geom.type === "Polygon") {
    return (geom.coordinates || []).flat().some((coord: any) => pointInBoundary(coord, boundary));
  }

  return true;
}


function boundaryBounds(boundary: any): [[number, number], [number, number]] | null {
  const rings = getPolygonRingsFromBoundary(boundary);
  const coords = rings.flat();

  if (!coords.length) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  coords.forEach((coord: [number, number]) => {
    if (!Array.isArray(coord) || coord.length < 2) return;
    minLng = Math.min(minLng, coord[0]);
    minLat = Math.min(minLat, coord[1]);
    maxLng = Math.max(maxLng, coord[0]);
    maxLat = Math.max(maxLat, coord[1]);
  });

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

function boundaryCenter(boundary: any): [number, number] | null {
  const rings = getPolygonRingsFromBoundary(boundary);
  const coords = rings.flat();

  if (!coords.length) return null;

  const sum = coords.reduce(
    (acc: [number, number], coord: [number, number]) => [acc[0] + coord[0], acc[1] + coord[1]],
    [0, 0]
  );

  return [sum[0] / coords.length, sum[1] / coords.length];
}

function disruptionColor(severity: string) {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "high":
      return "#f59e0b";
    case "medium":
      return "#3b82f6";
    default:
      return "#10b981";
  }
}

function getLineSeverityColor(load: number) {
  if (load >= 1.0) return "#ef4444";
  if (load >= 0.75) return "#f59e0b";
  if (load >= 0.5) return "#3b82f6";
  return "#22c55e";
}

function getLineWidth(load: number) {
  if (load >= 1.0) return 8;
  if (load >= 0.75) return 6;
  if (load >= 0.5) return 5;
  return 4;
}


function getProposalMapStyle(proposalId: string) {
  const outcomes = getDecisionLog()
    .filter((e: any) => String(e.proposalId) === String(proposalId))
    .filter((e: any) => e.outcome && typeof e.outcome.accuracyScore === "number");

  if (outcomes.length === 0) {
    return {
      color: "#22c55e",
      opacity: 0.8,
      width: 6,
    };
  }

  const avg =
    outcomes.reduce((sum: number, e: any) => sum + e.outcome.accuracyScore, 0) /
    outcomes.length;

  if (avg >= 80) {
    return {
      color: "#22c55e", // green
      opacity: 0.95,
      width: 8,
    };
  }

  if (avg >= 55) {
    return {
      color: "#f59e0b", // amber
      opacity: 0.75,
      width: 7,
    };
  }

  return {
    color: "#ef4444", // red
    opacity: 0.6,
    width: 6,
  };
}

function getLineOpacity(load: number) {
  if (load >= 1.0) return 0.95;
  if (load >= 0.75) return 0.82;
  if (load >= 0.5) return 0.7;
  return 0.55;
}

function getLineKey(d: any) {
  const line = String(d.line || "").toUpperCase();
  if (line.startsWith("M1")) return "M1";
  if (line.startsWith("M2")) return "M2";
  if (line.startsWith("M3")) return "M3";
  if (line.startsWith("T4")) return "T4";
  if (line.startsWith("X95")) return "X95";
  if (line.startsWith("040")) return "B040";
  if (line.startsWith("224")) return "B224";
  if (line.includes("METRO")) return "METRO";
  if (line.startsWith("X1")) return "BX1";
  return null;
}


function applyInterventionEffects(disruptions: any[], city: any, acceptedIds: string[]) {
  const proposals = city.INTERVENTIONS || [];

  return disruptions.map((d) => {
    let effectiveSeverity = d.effectiveSeverity ?? 1;
    let resolved = false;

    acceptedIds.forEach((id) => {
      const p = proposals.find((x: any) => String(x.id) === String(id));
      if (!p || p.disruptionId !== d.id) return;

      const fx = p.effects || {};

      if (typeof fx.severityDelta === "number") {
        effectiveSeverity += fx.severityDelta;
      }

      if (fx.resolveAtAcceptance) {
        resolved = true;
      }
    });

    return {
      ...d,
      effectiveSeverity: Math.max(0, Math.min(1, effectiveSeverity)),
      displaySeverity: d.displaySeverity ?? Math.max(0, Math.min(1, effectiveSeverity)),
      resolved,
    };
  });
}

function getHopImpactForDisruption(city: any, d: any) {
  const loc =
    d &&
    city?.MAP?.locations &&
    d.location &&
    city.MAP.locations[d.location]
      ? city.MAP.locations[d.location]
      : null;

  const hopScore = scoreHopAvailability(city.CITY_CONFIG.id, loc, 500);

  // Strong HOP availability reduces perceived disruption intensity.
  if (hopScore.score >= 75) return { hopScore, factor: 0.55 };
  if (hopScore.score >= 45) return { hopScore, factor: 0.78 };
  return { hopScore, factor: 1 };
}

function proposalUsesOperator(proposal: any, operator: string): boolean {
  if (!proposal) return false;
  const op = String(operator).toUpperCase();
  const keyRe = new RegExp(op, "i");
  const textRe = new RegExp(`\\b${op}\\b`, "i");
  const lr = proposal.effects?.loadRedistribution || {};
  if (Object.keys(lr).some((k) => keyRe.test(String(k)))) return true;
  const parts: any[] = [
    proposal.action,
    proposal.title,
    proposal.rationale,
    proposal.description,
    ...(Array.isArray(proposal.resources) ? proposal.resources : []),
  ];
  const text = parts.filter((v) => typeof v === "string").join(" ");
  return textRe.test(text);
}

function proposalUsesHop(proposal: any): boolean {
  return proposalUsesOperator(proposal, "HOP");
}

const MM_OPERATORS = ["hop", "dott", "lime"] as const;

function proposalUsesMicromobility(proposal: any): boolean {
  if (!proposal) return false;
  if (MM_OPERATORS.some((op) => proposalUsesOperator(proposal, op))) return true;

  const parts: any[] = [
    proposal.action,
    proposal.title,
    proposal.rationale,
    proposal.description,
    ...(Array.isArray(proposal.resources) ? proposal.resources : []),
  ];

  const text = parts.filter((v) => typeof v === "string").join(" ");
  return /\b(MM|micromobility|scooter|scooters|e-scooter|e-scooters)\b/i.test(text);
}

function getFocusedDisruption(city: any, sim: any, proposal: any): any | null {
  if (!proposal?.disruptionId) return null;

  return (
    (sim?.disruptions || []).find((d: any) => d.id === proposal.disruptionId) ||
    (city?.DISRUPTIONS || []).find((d: any) => d.id === proposal.disruptionId) ||
    null
  );
}


function buildHighlightShapes(selectedGtfsStop: any) {
  if (!selectedGtfsStop?.routes?.length) return [];

  return OASA_GTFS_SHAPES
    .filter((r: any) => selectedGtfsStop.routes.includes(r.shortName))
    .flatMap((r: any) =>
      r.shapes.map((shape: any) => ({
        type: "Feature",
        properties: { route: r.shortName },
        geometry: {
          type: "LineString",
          coordinates: shape.coordinates,
        },
      }))
    );
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const cosLat = Math.cos((a[1] * Math.PI) / 180);
  const dLat = (b[1] - a[1]) * 111000;
  const dLng = (b[0] - a[0]) * 111000 * cosLat;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function getNearbyMmOperatorStats(city: any, sim: any, proposalOrDisruption: any, radiusM = 600) {
  const disruption =
    proposalOrDisruption?.disruptionId
      ? getFocusedDisruption(city, sim, proposalOrDisruption)
      : proposalOrDisruption;

  const loc = disruption ? city?.MAP?.locations?.[disruption.location] : null;

  const vehicles = getMicromobilityVehicles(city.CITY_CONFIG.id);

  if (!isValidCoord(loc)) {
    return MM_OPERATORS.map((operator) => ({
      operator,
      totalNearby: vehicles.filter((v: any) => v.operator === operator).length,
      availableNearby: vehicles.filter((v: any) => v.operator === operator && v.available).length,
      avgDistance: Infinity,
    }));
  }

  return MM_OPERATORS.map((operator) => {
    const nearby = vehicles
      .filter((v: any) => v.operator === operator)
      .map((v: any) => ({
        vehicle: v,
        distance: distanceMeters(loc, [v.lng, v.lat]),
      }))
      .filter((x: any) => x.distance <= radiusM);

    const available = nearby.filter((x: any) => x.vehicle.available);
    const avgDistance =
      available.length > 0
        ? available.reduce((sum: number, x: any) => sum + x.distance, 0) / available.length
        : Infinity;

    return {
      operator,
      totalNearby: nearby.length,
      availableNearby: available.length,
      avgDistance,
    };
  });
}

function getNearbyMmOperatorPlan(city: any, sim: any, proposal: any, radiusM = 600) {
  const stats = getNearbyMmOperatorStats(city, sim, proposal, radiusM);

  const usable = stats
    .filter((x) => x.availableNearby > 0)
    .sort((a, b) => {
      if (b.availableNearby !== a.availableNearby) return b.availableNearby - a.availableNearby;
      return a.avgDistance - b.avgDistance;
    });

  // Operator-neutral rule:
  // use whichever MM operators have available scooters near the disruption.
  // This can naturally return 1, 2, or all 3 operators.
  return new Set((usable.length > 0 ? usable : stats).map((x) => x.operator));
}

function formatMmOperatorLabel(operator: string) {
  if (operator === "hop") return "HOP";
  if (operator === "dott") return "Dott";
  if (operator === "lime") return "Lime";
  return operator;
}


function detectConflictRisk(proposal: any, applied: any[]) {
  if (!proposal || applied.length === 0) return false;

  return applied.some((p: any) => {
    // Same disruption = strong overlap
    if (String(p.disruptionId) === String(proposal.disruptionId)) {
      // If both modify severity or redistribution → conflict risk
      const a = proposal.effects || {};
      const b = p.effects || {};

      if (a.severityDelta && b.severityDelta) return true;
      if (a.loadRedistribution && b.loadRedistribution) return true;
    }

    return false;
  });
}


function computeInterventionContribution(
  proposal: any,
  applied: any[]
) {
  if (!proposal || !applied || applied.length === 0) {
    return { delta: 0, share: 0 };
  }

  const totalImpact = applied.reduce((sum: number, p: any) => {
    return sum + Math.abs(Number(p.effects?.severityDelta || 0));
  }, 0);

  const ownImpact = Math.abs(Number(proposal.effects?.severityDelta || 0));

  if (totalImpact === 0) return { delta: 0, share: 0 };

  return {
    delta: proposal.effects?.severityDelta || 0,
    share: ownImpact / totalImpact,
  };
}

function detectDiminishingReturns(
  proposal: any,
  applied: any[]
) {
  if (!proposal || applied.length === 0) return false;

  const proposalImpact =
    Number(proposal.passengerMinutesSaved || proposal.paxMinutesSaved || 0);

  const appliedImpact = applied.reduce(
    (sum: number, p: any) =>
      sum + Number(p.passengerMinutesSaved || p.paxMinutesSaved || 0),
    0
  );

  if (appliedImpact === 0) return false;

  // If proposal adds less than 25% additional value → diminishing
  return proposalImpact < appliedImpact * 0.25;
}

function getMmPlanSummary(city: any, sim: any, proposal: any, radiusM = 600) {
  if (!proposalUsesMicromobility(proposal)) return null;

  const stats = getNearbyMmOperatorStats(city, sim, proposal, radiusM);
  const plan = getNearbyMmOperatorPlan(city, sim, proposal, radiusM);

  const selected = stats
    .filter((x) => plan.has(x.operator))
    .filter((x) => x.availableNearby > 0);

  const availableTotal = selected.reduce((sum, x) => sum + x.availableNearby, 0);

  return {
    stats,
    selected,
    availableTotal,
    label:
      selected.length > 0
        ? selected.map((x) => formatMmOperatorLabel(x.operator)).join(" + ")
        : "No nearby MM available",
  };
}

function numberToSeverity(value: number): string {
  if (value >= 0.9) return "critical";
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}

function isRoadMode(mode?: string) {
  const m = String(mode || "").toLowerCase();
  return m === "bus" || m === "taxi" || m === "micromobility";
}

function isTransitMode(mode?: string) {
  const m = String(mode || "").toLowerCase();
  return m === "metro" || m === "tram";
}

function getSegmentRange(cityId: string, disruptionId: string) {
  const table =
    cityId === "thessaloniki" ? THESSALONIKI_SEGMENT_RANGES : ATHENS_SEGMENT_RANGES;
  return (table as any)[disruptionId] || { start: 0, end: 1 };
}

function isValidCoord(coord: any): coord is [number, number] {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1]) &&
    Math.abs(coord[0]) <= 180 &&
    Math.abs(coord[1]) <= 90
  );
}

function sanitizeCoords(coords: any): [number, number][] {
  if (!Array.isArray(coords)) return [];
  return coords.filter(isValidCoord);
}

function sliceCoords(coords: [number, number][], startRatio: number, endRatio: number) {
  if (!coords || coords.length < 2) return coords;
  const startIndex = Math.max(0, Math.floor((coords.length - 1) * startRatio));
  const endIndex = Math.min(coords.length - 1, Math.ceil((coords.length - 1) * endRatio));
  const sliced = coords.slice(startIndex, endIndex + 1);
  return sliced.length >= 2 ? sliced : coords;
}

function getVisibleLineIds(sim: any, selectedId: string | null) {
  const visible = new Set<string>();
  const baseline = ["M1", "M2", "M3", "T4", "B040", "BX95"];

  for (const id of baseline) visible.add(id);

  const disrupted = new Set<string>();
  for (const d of sim.disruptions || []) {
    const key = getLineKey(d.source || d);
    if (typeof key === "string" && key) {
      disrupted.add(key);
      visible.add(key);
    }
  }

  const selected = (sim.disruptions || []).find((d: any) => d.id === selectedId);
  const selectedKey = selected ? getLineKey(selected.source || selected) : null;

  if (selectedKey) {
    visible.add(selectedKey);

    const fallbackMap: Record<string, string[]> = {
      M1: ["M2", "B040"],
      M2: ["M1", "M3", "B040"],
      M3: ["M2", "BX95"],
      T4: ["B040", "BX95"],
      B040: ["M1", "M2", "M3"],
      B224: ["B040"],
      BX95: ["M3", "B040"],
      METRO: [],
    };

    for (const alt of fallbackMap[selectedKey] || []) {
      visible.add(alt);
    }
  }

  return {
    visible,
    disrupted,
    selectedKey,
  };
}

function sqDist(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function getNearestStopsForSelectedDisruption(
  MAP: any,
  selectedDisruption: any,
  visibleLineIds: Set<string>
) {
  if (!selectedDisruption) return [];

  const lineKey = getLineKey(selectedDisruption.source || selectedDisruption);
  if (!lineKey) return [];

  const stops = MAP.transitStops?.[lineKey] || [];
  if (!Array.isArray(stops) || stops.length === 0) return [];

  const loc = MAP.locations?.[selectedDisruption.location];
  if (!isValidCoord(loc)) return [];

  // Find closest stop ON THE LINE
  let closestIndex = -1;
  let bestDist = Infinity;

  stops.forEach((stop: any, i: number) => {
    if (!isValidCoord(stop.coordinates)) return;
    const dx = stop.coordinates[0] - loc[0];
    const dy = stop.coordinates[1] - loc[1];
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      closestIndex = i;
    }
  });

  if (closestIndex === -1) return [];

  // Return corridor: previous + current + next 2 stops
  const result: any[] = [];

  for (let offset = -1; offset <= 2; offset++) {
    const idx = closestIndex + offset;
    if (idx >= 0 && idx < stops.length) {
      result.push({
        ...stops[idx],
        lineId: lineKey,
      });
    }
  }

  return result;
}

function buildSelectedProposalFeature(city: any, sim: any, proposalId: string | null) {
  if (!proposalId) return null;

  const proposal = (city.INTERVENTIONS || []).find((p: any) => String(p.id) === String(proposalId));
  if (!proposal) return null;

  const disruption =
    (sim.disruptions || []).find((d: any) => d.id === proposal.disruptionId) ||
    (city.DISRUPTIONS || []).find((d: any) => d.id === proposal.disruptionId);

  if (!disruption) return null;

  const from = disruption.fromStop?.coordinates;
  const to = disruption.toStop?.coordinates;

  if (isValidCoord(from) && isValidCoord(to)) {
    return {
      type: "Feature",
      properties: {
        proposalId,
        disruptionId: disruption.id,
      },
      geometry: {
        type: "LineString",
        coordinates: [from, to],
      },
    };
  }

  const loc = city.MAP?.locations?.[disruption.location];
  if (!isValidCoord(loc)) return null;

  const lineKey = getLineKey(disruption.source || disruption);
  const baseCoords =
    (lineKey ? city.MAP?.transitShapes?.[lineKey] : null) ||
    (lineKey ? city.MAP?.lines?.[lineKey] : null) ||
    city.MAP?.roadCorridors?.[disruption.id];

  const coords = sanitizeCoords(baseCoords);
  if (coords.length >= 2) {
    const range = getSegmentRange(city.CITY_CONFIG.id, disruption.id);
    const sliced = sliceCoords(coords, range.start, range.end);
    if (sliced.length >= 2) {
      return {
        type: "Feature",
        properties: {
          proposalId,
          disruptionId: disruption.id,
        },
        geometry: {
          type: "LineString",
          coordinates: sliced,
        },
      };
    }
  }

  return {
    type: "Feature",
    properties: {
      proposalId,
      disruptionId: disruption.id,
    },
    geometry: {
      type: "LineString",
      coordinates: [loc, loc],
    },
  };
}

function buildInterventionCorridorFeature(city: any, sim: any, proposalId: string) {
  const proposal = (city.INTERVENTIONS || []).find((p: any) => String(p.id) === String(proposalId));
  if (!proposal) return null;

  const disruption =
    (sim.disruptions || []).find((d: any) => d.id === proposal.disruptionId) ||
    (city.DISRUPTIONS || []).find((d: any) => d.id === proposal.disruptionId);

  if (!disruption) return null;

  const from = disruption.fromStop?.coordinates;
  const to = disruption.toStop?.coordinates;

  if (isValidCoord(from) && isValidCoord(to)) {
    return {
      type: "Feature",
      properties: {
        proposalId,
        disruptionId: disruption.id,
      },
      geometry: {
        type: "LineString",
        coordinates: [from, to],
      },
    };
  }

  const loc = city.MAP?.locations?.[disruption.location];
  if (!isValidCoord(loc)) return null;

  const lineKey = getLineKey(disruption.source || disruption);
  const coords =
    sanitizeCoords((lineKey ? city.MAP?.transitShapes?.[lineKey] : null) ||
    (lineKey ? city.MAP?.lines?.[lineKey] : null) ||
    city.MAP?.roadCorridors?.[disruption.id]);

  if (coords.length >= 2) {
    const range = getSegmentRange(city.CITY_CONFIG.id, disruption.id);
    const sliced = sliceCoords(coords, range.start, range.end);
    if (sliced.length >= 2) {
      return {
        type: "Feature",
        properties: {
          proposalId,
          disruptionId: disruption.id,
        },
        geometry: {
          type: "LineString",
          coordinates: sliced,
        },
      };
    }
  }

  return null;
}

function buildSelectedCorridorFeature(selectedDisruption: any) {
  const from = selectedDisruption?.fromStop?.coordinates;
  const to = selectedDisruption?.toStop?.coordinates;

  if (!isValidCoord(from) || !isValidCoord(to)) return null;

  return {
    type: "Feature",
    properties: {
      id: selectedDisruption.id,
    },
    geometry: {
      type: "LineString",
      coordinates: [from, to],
    },
  };
}

function asFeatureCollection(features: any) {
  return {
    type: "FeatureCollection",
    features: Array.isArray(features) ? features.filter(Boolean) : [],
  };
}


function ensureFeatureCollection(data: any) {
  if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
    return data;
  }

  if (Array.isArray(data)) {
    return {
      type: "FeatureCollection",
      features: data.filter(Boolean),
    };
  }

  if (data?.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [data],
    };
  }

  return {
    type: "FeatureCollection",
    features: [],
  };
}

function setGeoJsonSource(map: mapboxgl.Map, sourceId: string, data: any) {
  const safeData = ensureFeatureCollection(data) as any;
  const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;

  if (existing && typeof existing.setData === "function") {
    existing.setData(safeData);
    return;
  }

  map.addSource(sourceId, {
    type: "geojson",
    data: safeData,
  });
}

function getStaticDisruptionGeometry(MAP: any, d: any) {
  const lineKey = getLineKey(d.source || d);
  const mode = d.source?.mode || d.mode;

  if (isRoadMode(mode)) {
    return (
      MAP.roadCorridors?.[d.id] ||
      MAP.disruptionPaths?.[d.id] ||
      (lineKey ? MAP.lines?.[lineKey] : null)
    );
  }

  if (isTransitMode(mode)) {
    return (
      (lineKey ? MAP.transitShapes?.[lineKey] : null) ||
      MAP.disruptionPaths?.[d.id] ||
      (lineKey ? MAP.lines?.[lineKey] : null)
    );
  }

  return (
    MAP.disruptionPaths?.[d.id] ||
    MAP.roadCorridors?.[d.id] ||
    (lineKey ? MAP.transitShapes?.[lineKey] : null) ||
    (lineKey ? MAP.lines?.[lineKey] : null)
  );
}

type NetworkMapViewProps = {
  focusSelectedOnly?: boolean;
  autoZoomSelected?: boolean;
};

export default function NetworkMapView({
  focusSelectedOnly = false,
  autoZoomSelected = false,
}: NetworkMapViewProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const renderMapRef = useRef<null | (() => void)>(null);
  const lastAutoZoomedSelectionRef = useRef<string | null>(null);
  const showAppliedPreviewRef = useRef(true);
  const showAllMmRef = useRef(false);
  const focusModeRef = useRef<"all" | "selected" | "applied">("all");
  const [error, setError] = useState("");
  const [mmDebugCounts, setMmDebugCounts] = useState({ hop: 0, dott: 0, lime: 0 });
  const [showAllMm, setShowAllMm] = useState(false);
  const [inspectorDisruptionId, setInspectorDisruptionId] = useState<string | null>(null);
  const [selectedGtfsStop, setSelectedGtfsStop] = useState<any | null>(null);
  const selectedGtfsStopRef = useRef<any | null>(null);
  const [inspectorVersion, setInspectorVersion] = useState(0);
  const [showAppliedPreview, setShowAppliedPreview] = useState(true);
  const [focusMode, setFocusMode] = useState<"all" | "selected" | "applied">("all");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showFocusPanel, setShowFocusPanel] = useState(true);
  const [showOpsPanel, setShowOpsPanel] = useState(true);
  const [focusPanelPos, setFocusPanelPos] = useState({ x: 225, y: 64 });
  const [opsPanelPos, setOpsPanelPos] = useState({ x: 570, y: 64 });
  const [timelineUiState, setTimelineUiState] = useState(getTimelineState());

  const [aiControlMode, setAiControlMode] = useState<"off" | "suggest" | "auto">("suggest");
  const [autopilotLog, setAutopilotLog] = useState<any[]>([]);
  const lastAutoAppliedDisruptionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxgl.accessToken) return;

    const cityInitial = getCityData();
    resetHopMock(cityInitial.CITY_CONFIG.id);
    {
      const allInit = getMicromobilityVehicles(cityInitial.CITY_CONFIG.id);
      setMmDebugCounts({
        hop:  allInit.filter((v: any) => v.operator === "hop").length,
        dott: allInit.filter((v: any) => v.operator === "dott").length,
        lime: allInit.filter((v: any) => v.operator === "lime").length,
      });
    }
    const { MAP } = cityInitial;

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: isValidCoord(MAP.center) ? MAP.center : [23.7275, 37.9838],
        zoom: Number.isFinite(MAP.zoom) ? MAP.zoom : 11,
      });

      map.on("error", (e: any) => {
        const msg = e?.error?.message || e?.message || "Unknown Mapbox error";
        setError(String(msg));
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("click", (e: any) => {
        const layers = [
          ...(map.getLayer("gtfs-stops-hit-layer") ? ["gtfs-stops-hit-layer"] : []),
          ...(map.getLayer("gtfs-stops-layer") ? ["gtfs-stops-layer"] : []),
        ];

        if (!layers.length) return;

        const box: [[number, number], [number, number]] = [
          [e.point.x - 18, e.point.y - 18],
          [e.point.x + 18, e.point.y + 18],
        ];

        const features = map.queryRenderedFeatures(box, { layers });
        const feature = features?.[0];

        if (!feature) return;

        e.preventDefault();
        e.originalEvent?.stopPropagation?.();

        const props = feature.properties || {};
        const fullStop = OASA_GTFS_STOPS_WITH_ROUTES.find(
          (stop: any) => String(stop.stopId) === String(props.stopId)
        );

        console.log("GTFS STOP CLICKED", fullStop || props);
        selectedGtfsStopRef.current = fullStop || props;
        setSelectedGtfsStop(fullStop || props);
        requestAnimationFrame(() => renderMapRef.current?.());
      });

      map.on("mousemove", (e: any) => {
        if (!map.getLayer("gtfs-stops-hit-layer") && !map.getLayer("gtfs-stops-layer")) return;

        const box: [[number, number], [number, number]] = [
          [e.point.x - 8, e.point.y - 8],
          [e.point.x + 8, e.point.y + 8],
        ];

        const layers = [
          ...(map.getLayer("gtfs-stops-hit-layer") ? ["gtfs-stops-hit-layer"] : []),
          ...(map.getLayer("gtfs-stops-layer") ? ["gtfs-stops-layer"] : []),
        ];

        const features = map.queryRenderedFeatures(box, { layers });
        map.getCanvas().style.cursor = features.length ? "pointer" : "";
      });

      function render() {
        try {
          const city = getCityData();
          const { MAP } = city;
          const municipalityBoundary = getMunicipalityBoundaryForCity(city.CITY_CONFIG.id);
          const municipalityFocusActive = !!municipalityBoundary;
          const selectedId = getSelectedId();
          const selectedProposalId = getSelectedProposalId();
          const acceptedProposalIds = getAccepted();
          const acceptedDisruptionIds = new Set(
            acceptedProposalIds
              .map((id: string) => (city.INTERVENTIONS || []).find((p: any) => String(p.id) === String(id)))
              .filter(Boolean)
              .map((proposal: any) => String(proposal.disruptionId))
          );
          const sim = getSimulationState(city.CITY_CONFIG.id, getTimelineState().currentMinute);
          const disruptionsWithEffectsApplied = applyInterventionEffects(sim.disruptions, city, acceptedProposalIds);
          const disruptionsWithEffects = showAppliedPreviewRef.current
            ? disruptionsWithEffectsApplied.map((d: any) => ({
                ...d,
                displaySeverity:
                  typeof d.effectiveSeverity === "number"
                    ? d.effectiveSeverity
                    : typeof d.severity === "number"
                    ? d.severity
                    : 1,
              }))
            : ((sim.disruptions || []).map((d: any) => ({
                ...d,
                effectiveSeverity:
                  typeof d.severity === "number"
                    ? d.severity
                    : 1,
                displaySeverity:
                  typeof d.severity === "number"
                    ? d.severity
                    : 1,
                resolved: false,
              })));

          const focusedProposal = selectedProposalId
            ? (city.INTERVENTIONS || []).find((p: any) => String(p.id) === String(selectedProposalId))
            : null;

          const focusedDisruptionId = focusedProposal?.disruptionId
            ? String(focusedProposal.disruptionId)
            : null;

          const activeFocusMode = focusModeRef.current;

          const focusedDisruptionIds = new Set<string>();
          if (activeFocusMode === "selected" && selectedId) {
            focusedDisruptionIds.add(String(selectedId));
          }
          if (activeFocusMode === "applied") {
            acceptedDisruptionIds.forEach((id) => focusedDisruptionIds.add(String(id)));
          }
          if (focusedDisruptionId) {
            focusedDisruptionIds.add(String(focusedDisruptionId));
          }

          const shouldShowDisruption = (d: any) => {
            // Network tab selected focus keeps context visible; styling dims non-selected items.
            if (focusSelectedOnly && selectedId) return true;

            if (focusedDisruptionId && String(d.id) !== String(focusedDisruptionId)) return false;
            if (activeFocusMode === "selected" && selectedId && String(d.id) !== String(selectedId)) return false;
            if (activeFocusMode === "applied") return acceptedDisruptionIds.has(String(d.id));
            return true;
          };

          const focusFilteredDisruptions = disruptionsWithEffects.filter(shouldShowDisruption);

          if (autoZoomSelected && selectedId && lastAutoZoomedSelectionRef.current !== String(selectedId)) {
            const selectedForZoom = disruptionsWithEffects.find((d: any) => String(d.id) === String(selectedId));
            const zoomLoc = selectedForZoom
              ? MAP.locations?.[selectedForZoom.location]
              : null;

            if (isValidCoord(zoomLoc)) {
              lastAutoZoomedSelectionRef.current = String(selectedId);
              map.flyTo({
                center: zoomLoc,
                zoom: Math.max(map.getZoom(), 14),
                speed: 1.2,
                curve: 1.4,
                essential: true,
              });
            }
          }

          if (!selectedId) {
            lastAutoZoomedSelectionRef.current = null;
          }

          const visibleDisruptionsRaw = focusedDisruptionId
            ? focusFilteredDisruptions.filter((d: any) => String(d.id) === focusedDisruptionId)
            : focusFilteredDisruptions;

          const visibleDisruptions = municipalityFocusActive
            ? visibleDisruptionsRaw.filter((d: any) => {
                const loc = city.MAP?.locations?.[d.location];
                return pointInBoundary(loc, municipalityBoundary);
              })
            : visibleDisruptionsRaw;


          const simNetworkById = Object.fromEntries(
            sim.network.map((line: any) => [line.lineId, line])
          );

          sim.disruptions.forEach((d: any) => {
            const mode = d.source?.mode || d.mode;
            if (!isRoadMode(mode)) return;

            const seed = sanitizeCoords(getStaticDisruptionGeometry(MAP, d));
            if (seed.length >= 2) {
              ensureRoadGeometry(city.CITY_CONFIG.id, d.id, mode, seed as [number, number][]);
            }
          });

          const lineState = getVisibleLineIds(sim, selectedId);

          const networkFeatures = Object.entries(MAP.lines || {})
            .filter(([lineId]) => lineState.visible.has(String(lineId)))
            .map(([lineId, rawCoords]) => {
              const coords = sanitizeCoords(rawCoords);
              if (coords.length < 2) return null;

              const simLine = simNetworkById[lineId];
              const load = simLine?.effectiveLoad ?? 0.4;
              const isSelectedLine = lineState.selectedKey === lineId;
              const isDisruptedLine = lineState.disrupted.has(String(lineId));

              return {
                type: "Feature",
                properties: {
                  lineId,
                  effectiveLoad: load,
                  degraded: simLine?.degraded ? 1 : 0,
                  color: getLineSeverityColor(load),
                  width: isSelectedLine ? Math.max(getLineWidth(load), 7) : isDisruptedLine ? Math.max(getLineWidth(load), 5) : 3,
                  opacity:
                    focusSelectedOnly && selectedId && !isSelectedLine
                      ? 0.12
                      : isSelectedLine
                      ? 0.95
                      : isDisruptedLine
                      ? 0.38
                      : 0.16,
                },
                geometry: {
                  type: "LineString",
                  coordinates: coords,
                },
              };
            })
            .filter(Boolean)
            .filter((feature: any) =>
              municipalityFocusActive ? featureTouchesBoundary(feature, municipalityBoundary) : true
            );

          const disruptionLineFeatures = visibleDisruptions
            .filter((d: any) => !d.resolved).map((d: any) => {
              const mode = d.source?.mode || d.mode;
              const staticCoords = sanitizeCoords(getStaticDisruptionGeometry(MAP, d));
              const key = roadGeometryKey(city.CITY_CONFIG.id, d.id, mode);
              const routedRoadCoords = isRoadMode(mode) ? sanitizeCoords(getRoadGeometry(key)) : [];
              const range = getSegmentRange(city.CITY_CONFIG.id, d.id);

              const coordsBase = routedRoadCoords.length >= 2 ? routedRoadCoords : staticCoords;
              const coords =
                coordsBase.length >= 2 ? sliceCoords(coordsBase, range.start, range.end) : [];

              if (coords.length < 2) return null;

              return {
                type: "Feature",
                properties: {
                  id: d.id,
                  mode: mode || "",
                  severity: numberToSeverity(d.effectiveSeverity),
                  selected: d.id === selectedId ? 1 : 0,
                  effectiveSeverity: d.effectiveSeverity ?? 1,
                displaySeverity: d.displaySeverity ?? d.effectiveSeverity ?? d.severity ?? 1,
                },
                geometry: {
                  type: "LineString",
                  coordinates: coords,
                },
              };
            })
            .filter(Boolean)
            .filter((feature: any) =>
              municipalityFocusActive ? featureTouchesBoundary(feature, municipalityBoundary) : true
            );

          const pointFeatures = visibleDisruptions
            .filter((d: any) => !d.resolved).map((d: any) => {
              const coords = MAP.locations?.[d.location];
              if (!isValidCoord(coords)) return null;

              return {
                type: "Feature",
                properties: {
                  id: d.id,
                  severity: numberToSeverity(d.effectiveSeverity),
                  selected: d.id === selectedId ? 1 : 0,
                  effectiveSeverity: d.effectiveSeverity ?? 1,
                displaySeverity: d.displaySeverity ?? d.effectiveSeverity ?? d.severity ?? 1,
                },
                geometry: {
                  type: "Point",
                  coordinates: coords,
                },
              };
            })
            .filter(Boolean);

          const stopFeatures = Object.entries(MAP.transitStops || {})
            .filter(([lineId]) => lineState.visible.has(String(lineId)))
            .flatMap(([lineId, stops]: any) =>
              (Array.isArray(stops) ? stops : [])
                .map((stop: any) => {
                  if (!isValidCoord(stop.coordinates)) return null;
                  return {
                    type: "Feature",
                    properties: {
                      lineId,
                      name: stop.name || stop.id || "",
                      selectedLine: lineState.selectedKey === lineId ? 1 : 0,
                    },
                    geometry: {
                      type: "Point",
                      coordinates: stop.coordinates,
                    },
                  };
                })
                .filter(Boolean)
            );

          const endpointFeatures = Object.entries(MAP.transitEndpoints || {})
            .filter(([lineId]) => lineState.visible.has(String(lineId)))
            .flatMap(([lineId, endpoints]: any) => {
              const out: any[] = [];

              if (isValidCoord(endpoints?.from?.coordinates)) {
                out.push({
                  type: "Feature",
                  properties: {
                    lineId,
                    label: endpoints.from.name || `${lineId} origin`,
                  },
                  geometry: {
                    type: "Point",
                    coordinates: endpoints.from.coordinates,
                  },
                });
              }

              if (isValidCoord(endpoints?.to?.coordinates)) {
                out.push({
                  type: "Feature",
                  properties: {
                    lineId,
                    label: endpoints.to.name || `${lineId} terminus`,
                  },
                  geometry: {
                    type: "Point",
                    coordinates: endpoints.to.coordinates,
                  },
                });
              }

              return out;
            });

          const selectedDisruption = disruptionsWithEffects.find((d: any) => d.id === selectedId);
          const selectedNearestStops = getNearestStopsForSelectedDisruption(
            MAP,
            selectedDisruption,
            lineState.visible
          );

          const selectedCorridorFeature = buildSelectedCorridorFeature(selectedDisruption);

          const selectedStopKeys = new Set(
            selectedNearestStops.map((s: any) => `${s.lineId}::${s.id || s.name}`)
          );

          const networkData = asFeatureCollection(networkFeatures);

          const disruptionLineData = asFeatureCollection(disruptionLineFeatures);

          const pointData = asFeatureCollection(pointFeatures);

          const stopData = asFeatureCollection(
            stopFeatures.map((f: any) => ({
              ...f,
              properties: {
                ...f.properties,
                selectedStop: selectedStopKeys.has(
                  `${f.properties.lineId}::${f.properties.name}`
                ) ? 1 : 0,
              },
            }))
          );

          const endpointData = asFeatureCollection(endpointFeatures);

          const selectedStopData = asFeatureCollection(
            selectedNearestStops.map((stop: any) => ({
              type: "Feature",
              properties: {
                lineId: stop.lineId,
                name: stop.name || stop.id || "",
              },
              geometry: {
                type: "Point",
                coordinates: stop.coordinates,
              },
            }))
          );

          const selectedImpactZoneData = asFeatureCollection(
            selectedDisruption && isValidCoord(MAP.locations?.[selectedDisruption.location])
              ? [{
                  type: "Feature",
                  properties: {
                    disruptionId: selectedDisruption.id,
                    displaySeverity:
                      selectedDisruption.displaySeverity ??
                      selectedDisruption.effectiveSeverity ??
                      selectedDisruption.severity ??
                      1,
                    affectedPax: selectedDisruption.affectedPax ?? 0,
                  },
                  geometry: {
                    type: "Point",
                    coordinates: MAP.locations[selectedDisruption.location],
                  },
                }]
              : []
          );

          const selectedAffectedAreaData = asFeatureCollection(
            selectedDisruption && isValidCoord(MAP.locations?.[selectedDisruption.location])
              ? selectedNearestStops.slice(0, 4).map((stop: any) => ({
                  type: "Feature",
                  properties: {
                    disruptionId: selectedDisruption.id,
                    stopName: stop.name || stop.id || "",
                    lineId: stop.lineId,
                    displaySeverity:
                      selectedDisruption.displaySeverity ??
                      selectedDisruption.effectiveSeverity ??
                      selectedDisruption.severity ??
                      1,
                  },
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      MAP.locations[selectedDisruption.location],
                      stop.coordinates,
                    ],
                  },
                }))
              : []
          );

          const selectedProposalFeature = buildSelectedProposalFeature(city, sim, selectedProposalId);

          const selectedCorridorData = asFeatureCollection(
            selectedCorridorFeature ? [selectedCorridorFeature] : []
          );

          const selectedProposalData = asFeatureCollection(
            selectedProposalFeature ? [selectedProposalFeature] : []
          );

          const selectedProposalPointData = asFeatureCollection(
            selectedProposalFeature
              ? [{
                  type: "Feature",
                  properties: selectedProposalFeature.properties,
                  geometry: {
                    type: "Point",
                    coordinates: selectedProposalFeature.geometry.coordinates[0],
                  },
                }]
              : []
          );

          const acceptedInterventionData = {
            type: "FeatureCollection",
            features: acceptedProposalIds
              .map((id: string) => buildInterventionCorridorFeature(city, sim, id))
              .filter((feature: any) => {
                if (!feature) return false;
                if (focusModeRef.current !== "applied") return true;
                return acceptedDisruptionIds.has(String(feature.properties?.disruptionId));
              }),
          };

          [
            "gtfs-highlight-lines",
            "gtfs-stops-hit-layer",
            "gtfs-highlight-lines-glow",
            "gtfs-highlight-flow",
            "gtfs-stops-layer",
            "traffic-live",
            "network-lines",
            "disruption-lines",
            "hop-mitigation-glow",
            "disruption-points",
            "hop-vehicles",
            "transit-stops",
            "transit-endpoints",
            "transit-endpoint-labels",
            "selected-impact-zone",
            "selected-impact-core",
            "selected-affected-area",
            "selected-stops",
            "selected-stop-labels",
            "selected-corridor",
            "selected-proposal-glow",
            "selected-proposal-line",
            "selected-proposal-point",
            "gtfs-impact-pulse",
            "gtfs-reroute-lines",
            "gtfs-reroute-glow",
            "gtfs-stress-glow",
            "gtfs-stress-lines",
            "gtfs-passenger-flow",
            "gtfs-failure-glow",
            "gtfs-failure-lines",
            "gtfs-resilience-lines",
            "gtfs-heatfield",
            "gtfs-recovery-lines",
            "gtfs-recovery-glow",
            "municipality-boundary-fill",
            "municipality-boundary-line",
            "municipality-boundary-fill",
          ].forEach((layerId) => {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
          });

          [
            "gtfs-highlight-src",
            "gtfs-stops-src",
            "traffic-live-src",
            "network-lines-src",
            "disruption-lines-src",
            "disruption-points-src",
            "hop-vehicles-src",
            "transit-stops-src",
            "transit-endpoints-src",
            "selected-impact-zone-src",
            "selected-affected-area-src",
            "selected-stops-src",
            "selected-corridor-src",
            "selected-proposal-src",
            "selected-proposal-point-src",
            "gtfs-impact-pulse-src",
            "gtfs-reroute-src",
            "gtfs-stress-src",
            "gtfs-passenger-flow-src",
            "gtfs-failure-src",
            "gtfs-resilience-src",
            "gtfs-heatfield-src",
            "gtfs-recovery-src",
            "municipality-boundary-src",
          ].forEach((srcId) => {
            if (map.getSource(srcId)) map.removeSource(srcId);
          });
          if (municipalityBoundary) {
            map.addSource("municipality-boundary-src", {
              type: "geojson",
              data: municipalityBoundary as any,
            });

            map.addLayer({
              id: "municipality-boundary-fill",
              type: "fill",
              source: "municipality-boundary-src",
              paint: {
                "fill-color": "#38bdf8",
                "fill-opacity": 0.005,
              },
            });

            map.addLayer({
              id: "municipality-boundary-line",
              type: "line",
              source: "municipality-boundary-src",
              paint: {
                "line-color": "#00e5ff",
                "line-width": 1.5,
                "line-opacity": 1,
                "line-blur": 0,
              },
            });
          }

          map.addSource("traffic-live-src", {
            type: "vector",
            url: "mapbox://mapbox.mapbox-traffic-v1",
          });

          map.addLayer({
            id: "traffic-live",
            type: "line",
            source: "traffic-live-src",
            "source-layer": "traffic",
            paint: {
              "line-color": [
                "match",
                ["get", "congestion"],
                "low", "#22c55e",
                "moderate", "#f59e0b",
                "heavy", "#ef4444",
                "severe", "#991b1b",
                "#64748b",
              ],
              "line-width": 2,
              "line-opacity": 0.28,
              "line-offset": 1.5,
            },
          });

          map.addSource("network-lines-src", {
            type: "geojson",
            data: ensureFeatureCollection(networkData) as any,
          });

          map.addLayer({
            id: "network-lines",
            type: "line",
            source: "network-lines-src",
            paint: {
              "line-color": ["get", "color"],
              "line-width": ["get", "width"],
              "line-opacity": ["get", "opacity"],
            },
          });

          const gtfsMetroFeatures = OASA_GTFS_SHAPES
            .filter((route: any) => route.shapes && route.shapes.length > 0)
            .flatMap((route: any) =>
              (route.shapes || []).map((shape: any) => ({
                type: "Feature",
                properties: {
                  routeId: route.routeId,
                  shortName: route.shortName,
                  routeType: route.type,
                  color:
                    route.shortName === "M1" ? "#009944" :
                    route.shortName === "M2" ? "#e30613" :
                    route.shortName === "M3" ? "#0057b8" :
                    route.color || (
                      route.type === "1" ? "#3b82f6" :
                      route.type === "0" ? "#22c55e" :
                      route.type === "3" ? "#94a3b8" :
                      "#64748b"
                    ),
                },
                geometry: {
                  type: "LineString",
                  coordinates: shape.coordinates,
                },
              }))
            );

          if (map.getLayer("gtfs-metro-shapes")) {
            map.removeLayer("gtfs-metro-shapes");
          }
          if (map.getSource("gtfs-metro-shapes-src")) {
            map.removeSource("gtfs-metro-shapes-src");
          }

          map.addSource("gtfs-metro-shapes-src", {
            type: "geojson",
            data: ensureFeatureCollection(gtfsMetroFeatures) as any,
          });

          map.addLayer({
            id: "gtfs-metro-shapes",
            type: "line",
            source: "gtfs-metro-shapes-src",
            paint: {
              "line-color": ["get", "color"],
              "line-width": [
                "case",
                ["in", ["get", "shortName"], ["literal", ["M1", "M2", "M3"]]],
                3.8,
                ["==", ["get", "routeType"], "0"],
                2.2,
                0.55
              ],
              "line-opacity": [
                "case",
                ["in", ["get", "shortName"], ["literal", ["M1", "M2", "M3"]]],
                0.82,
                ["==", ["get", "routeType"], "0"],
                0.35,
                0.08
              ],
            },
          });

          map.addSource("disruption-lines-src", {
            type: "geojson",
            data: ensureFeatureCollection(disruptionLineData) as any,
          });

          map.addLayer({
            id: "hop-mitigation-glow",
            type: "line",
            source: "disruption-lines-src",
            filter: [">=", ["coalesce", ["get", "hopScore"], 0], 45],
            paint: {
              "line-color": "#22c55e",
              "line-width": [
                "case",
                [">=", ["coalesce", ["get", "hopScore"], 0], 75],
                13,
                9
              ],
              "line-opacity": [
                "case",
                [">=", ["coalesce", ["get", "hopScore"], 0], 75],
                0.28,
                0.16
              ],
              "line-blur": 4,
            },
          });

          map.addLayer({
            id: "disruption-lines",
            type: "line",
            source: "disruption-lines-src",
            paint: {
              "line-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "displaySeverity"], ["get", "effectiveSeverity"], 1],
                0.0, "#22c55e",
                0.35, "#eab308",
                0.65, "#f59e0b",
                0.9, "#ef4444"
              ],
              "line-width": [
                "case",
                ["==", ["get", "selected"], 1],
                12,
                ["==", ["get", "dimmed"], 1],
                3,
                ["max", 3, ["*", ["coalesce", ["get", "displaySeverity"], ["get", "effectiveSeverity"], 1], 9]],
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "selected"], 1],
                1,
                ["==", ["get", "dimmed"], 1],
                0.16,
                ["max", 0.18, ["*", ["coalesce", ["get", "displaySeverity"], ["get", "effectiveSeverity"], 1], 0.9]],
              ],
              "line-blur": [
                "case",
                ["==", ["get", "selected"], 1],
                0.4,
                ["==", ["get", "dimmed"], 1],
                2.2,
                0.3,
              ],
              "line-color-transition": { duration: 450, delay: 0 },
              "line-width-transition": { duration: 450, delay: 0 },
              "line-opacity-transition": { duration: 450, delay: 0 },
              "line-blur-transition": { duration: 450, delay: 0 },
            },
          });

          map.addSource("disruption-points-src", {
            type: "geojson",
            data: ensureFeatureCollection(pointData) as any,
          });

          // Per-operator focus filter: when a proposal is focused, only show vehicles
          // whose operator the proposal actually relies on AND are within ~600m of the
          // focused disruption. Non-relevant operators are hidden entirely.
          const allMmVehicles: any[] = getMicromobilityVehicles(city.CITY_CONFIG.id)
            .filter((v: any) =>
              municipalityFocusActive
                ? pointInBoundary([v.lng, v.lat], municipalityBoundary)
                : true
            );
          let mmVehicleList: any[] = [];
          const RADIUS_M = 600;

          const isNearAnyLocation = (v: any, locations: any[]) => {
            return locations.some((loc: any) => {
              if (!isValidCoord(loc)) return false;
              const cosLat = Math.cos((loc[1] * Math.PI) / 180);
              const dLat = v.lat - loc[1];
              const dLng = (v.lng - loc[0]) * cosLat;
              const rad = RADIUS_M / 111000;
              return dLat * dLat + dLng * dLng <= rad * rad;
            });
          };

          if (showAllMmRef.current) {
            mmVehicleList = allMmVehicles;
          } else if (focusedProposal) {
            const focusedDisruption =
              (sim.disruptions || []).find((d: any) => d.id === focusedProposal.disruptionId) ||
              (city.DISRUPTIONS || []).find((d: any) => d.id === focusedProposal.disruptionId);
            const focusedLoc = focusedDisruption
              ? city.MAP?.locations?.[focusedDisruption.location]
              : null;

            const operatorPlan = getNearbyMmOperatorPlan(city, sim, focusedProposal, RADIUS_M);

            mmVehicleList = allMmVehicles.filter((v: any) => {
              if (proposalUsesMicromobility(focusedProposal) && !operatorPlan.has(v.operator)) return false;
              if (!proposalUsesMicromobility(focusedProposal) && !proposalUsesOperator(focusedProposal, v.operator)) return false;
              if (!isValidCoord(focusedLoc)) return true;
              return isNearAnyLocation(v, [focusedLoc]);
            });
          } else if ((activeFocusMode === "selected" || focusSelectedOnly) && selectedId) {
            const selectedForMm = disruptionsWithEffects.find((d: any) => String(d.id) === String(selectedId));
            const selectedLoc = selectedForMm ? MAP.locations?.[selectedForMm.location] : null;

            mmVehicleList = allMmVehicles.filter((v: any) => {
              if (!v.available) return false;
              return isNearAnyLocation(v, [selectedLoc]);
            });
          } else if (activeFocusMode === "applied") {
            const appliedLocations = disruptionsWithEffects
              .filter((d: any) => acceptedDisruptionIds.has(String(d.id)))
              .map((d: any) => MAP.locations?.[d.location])
              .filter(isValidCoord);

            mmVehicleList = allMmVehicles.filter((v: any) => {
              if (!v.available) return false;
              return isNearAnyLocation(v, appliedLocations);
            });
          } else {
            // All disruptions = clean overview, no MM dots unless manually toggled ON.
            mmVehicleList = [];
          }

          const hopVehicleDataForSource = ensureFeatureCollection(
            mmVehicleList.map((v: any) => ({
              type: "Feature",
              properties: {
                id: v.id,
                operator: String(v.operator || "hop"),
                battery: v.battery,
                available: v.available ? 1 : 0,
              },
              geometry: {
                type: "Point",
                coordinates: [v.lng, v.lat],
              },
            }))
          );

          {
            const allMm = getMicromobilityVehicles(city.CITY_CONFIG.id);
            setMmDebugCounts({
              hop:  allMm.filter((v: any) => v.operator === "hop").length,
              dott: allMm.filter((v: any) => v.operator === "dott").length,
              lime: allMm.filter((v: any) => v.operator === "lime").length,
            });
          }
          setGeoJsonSource(map, "hop-vehicles-src", hopVehicleDataForSource);

          map.addLayer({
            id: "hop-vehicles",
            type: "circle",
            source: "hop-vehicles-src",
            paint: {
              "circle-radius": 7,
              "circle-color": [
                "match",
                ["get", "operator"],
                "hop",  "#ef4444",
                "dott", "#3b82f6",
                "lime", "#22c55e",
                "#94a3b8"
              ],
              "circle-opacity": [
                "case",
                ["==", ["get", "available"], 1],
                0.95,
                0.45
              ],
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#0a0c10",
            },
          });

          const gtfsStop = selectedGtfsStopRef.current;
          const highlightRoutes = new Set<string>(gtfsStop?.routeList || []);
          const highlightShapes = highlightRoutes.size > 0
            ? (OASA_GTFS_SHAPES as any[]).filter((s: any) => highlightRoutes.has(s.shortName))
            : [];


          map.addSource("gtfs-stops-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: OASA_GTFS_STOPS_WITH_ROUTES.map((stop: any) => ({
                type: "Feature",
                properties: {
                  stopId: stop.stopId,
                  code: stop.code,
                  name: stop.name,
                  routes: JSON.stringify(stop.routes || []),
                },
                geometry: {
                  type: "Point",
                  coordinates: stop.coordinates,
                },
              })),
            },
          });

          const activeGtfsStop = selectedGtfsStopRef.current || selectedGtfsStop;

          const selectedStopRoutes = Array.isArray(activeGtfsStop?.routes)
            ? activeGtfsStop.routes.map(String)
            : [];

          const gtfsHighlightFeatures = selectedStopRoutes.length
            ? OASA_GTFS_SHAPES
                .filter((route: any) => selectedStopRoutes.includes(String(route.shortName)))
                .flatMap((route: any) =>
                  (route.shapes || []).map((shape: any) => ({
                    type: "Feature",
                    properties: {
                      route: route.shortName,
                      severity:
                        stopLinkedDisruptions.find((d: any) => {
                          const parts = [
                            d.line,
                            d.route,
                            d.routeShortName,
                            d.title,
                            d.name,
                          ]
                            .filter(Boolean)
                            .map(String);

                          return parts.some((p: string) =>
                            p.includes(String(route.shortName))
                          );
                        })?.effectiveSeverity || 0,
                    },
                    geometry: {
                      type: "LineString",
                      coordinates: shape.coordinates,
                    },
                  }))
                )
            : [];


          console.log("[GTFS DEBUG]", {
            selectedGtfsStop,
            selectedStopRoutes,
            routesCount: selectedStopRoutes.length,
            shapesCount: OASA_GTFS_SHAPES?.length,
            highlightCount: gtfsHighlightFeatures.length,
            sampleShape: OASA_GTFS_SHAPES?.[0],
          });

          if (map.getLayer("gtfs-highlight-lines")) {
            map.removeLayer("gtfs-highlight-lines");
          }
          if (map.getLayer("gtfs-highlight-lines-glow")) {
            map.removeLayer("gtfs-highlight-lines-glow");
          }
          if (map.getLayer("gtfs-highlight-flow")) {
            map.removeLayer("gtfs-highlight-flow");
          }
          if (map.getSource("gtfs-highlight-src")) {
            map.removeSource("gtfs-highlight-src");
          }

          map.addSource("gtfs-highlight-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: gtfsHighlightFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-highlight-lines-glow",
            type: "line",
            source: "gtfs-highlight-src",
            paint: {
              "line-color": "#fde047",
              "line-width": selectedStopRoutes.length ? 9 : 0,
              "line-opacity": selectedStopRoutes.length ? 0.28 : 0,
              "line-blur": 4,
            },
          });

          map.addLayer({
            id: "gtfs-highlight-lines",
            type: "line",
            source: "gtfs-highlight-src",
            paint: {
              "line-color": [
                "case",
                [">=", ["get", "severity"], 0.85], "#ef4444",
                [">=", ["get", "severity"], 0.6], "#f97316",
                [">=", ["get", "severity"], 0.35], "#facc15",
                "#22c55e"
              ],
              "line-width": selectedStopRoutes.length ? 4.5 : 0,
              "line-opacity": selectedStopRoutes.length ? 0.95 : 0,
            },
          });

          map.addLayer({
            id: "gtfs-highlight-flow",
            type: "line",
            source: "gtfs-highlight-src",
            paint: {
              "line-color": "#ffffff",
              "line-width": selectedStopRoutes.length ? 1.6 : 0,
              "line-opacity": 0.9,
              "line-dasharray": [0, 2, 3],
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });



          const impactPulseFeatures = stopLinkedDisruptions
            .filter((d: any) => {
              const sev =
                typeof d.effectiveSeverity === "number"
                  ? d.effectiveSeverity
                  : typeof d.severity === "number"
                  ? d.severity
                  : 0;

              return sev >= 0.45;
            })
            .map((d: any) => {
              const coord =
                city.MAP?.locations?.[d.location];

              if (
                !coord ||
                !Array.isArray(coord) ||
                coord.length < 2
              ) {
                return null;
              }

              const sev =
                typeof d.effectiveSeverity === "number"
                  ? d.effectiveSeverity
                  : typeof d.severity === "number"
                  ? d.severity
                  : 0;

              return {
                type: "Feature",
                properties: {
                  severity: sev,
                },
                geometry: {
                  type: "Point",
                  coordinates: coord,
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-impact-pulse-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: impactPulseFeatures,
            },
          });

          const rerouteFeatures = stopLinkedDisruptions
            .map((d: any) => {
              const disruptionCoord = city.MAP?.locations?.[d.location];
              if (!Array.isArray(disruptionCoord)) return null;

              const nearbyHop = hopVehicles.find((v: any) => {
                if (!Array.isArray(v.coordinates)) return false;
                return distanceMeters(disruptionCoord, v.coordinates) < 1200;
              });

              if (!nearbyHop) return null;

              return {
                type: "Feature",
                properties: {
                  severity: d.effectiveSeverity || d.severity || 0.5,
                },
                geometry: {
                  type: "LineString",
                  coordinates: [disruptionCoord, nearbyHop.coordinates],
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-reroute-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: rerouteFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-reroute-glow",
            type: "line",
            source: "gtfs-reroute-src",
            paint: {
              "line-color": "#22d3ee",
              "line-width": 10,
              "line-opacity": 0.18,
              "line-blur": 3,
            },
          });

          map.addLayer({
            id: "gtfs-reroute-lines",
            type: "line",
            source: "gtfs-reroute-src",
            paint: {
              "line-color": "#67e8f9",
              "line-width": 3,
              "line-opacity": 0.95,
              "line-dasharray": [2, 2],
            },
          });

          const stressFeatures = gtfsHighlightFeatures
            .map((feature: any) => {
              const severity =
                typeof feature.properties?.severity === "number"
                  ? feature.properties.severity
                  : 0;

              const stress =
                severity > 0
                  ? Math.min(1, severity + 0.28)
                  : selectedStopRoutes.length
                  ? 0.42
                  : 0;

              if (stress < 0.35) return null;

              return {
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  stress,
                },
              };
            })
            .filter(Boolean);

          console.log("[GTFS STRESS DEBUG]", {
            selectedStopRoutes,
            highlightCount: gtfsHighlightFeatures.length,
            stressCount: stressFeatures.length,
            sampleStress: stressFeatures[0],
          });

          map.addSource("gtfs-stress-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: stressFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-stress-glow",
            type: "line",
            source: "gtfs-stress-src",
            paint: {
              "line-color": "#ef4444",
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "stress"],
                0.35, 8,
                1, 18
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "stress"],
                0.35, 0.12,
                1, 0.42
              ],
              "line-blur": 6,
            },
          });


          const passengerFlowFeatures = stressFeatures
            .map((feature: any) => {
              const stress =
                typeof feature.properties?.stress === "number"
                  ? feature.properties.stress
                  : 0;

              if (stress < 0.4) return null;

              return {
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  load: Math.min(1, stress + 0.12),
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-passenger-flow-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: passengerFlowFeatures,
            },
          });


          const failureForecastFeatures = passengerFlowFeatures
            .map((feature: any) => {
              const load =
                typeof feature.properties?.load === "number"
                  ? feature.properties.load
                  : 0;

              const severity =
                typeof feature.properties?.severity === "number"
                  ? feature.properties.severity
                  : 0;

              const risk =
                Math.min(
                  1,
                  (load * 0.45) +
                  (severity * 0.4) +
                  (rerouteFeatures.length > 0 ? 0.15 : 0)
                );

              if (risk < 0.58) return null;

              return {
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  risk,
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-failure-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: failureForecastFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-failure-glow",
            type: "line",
            source: "gtfs-failure-src",
            paint: {
              "line-color": "#ff00aa",
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "risk"],
                0.58, 12,
                1, 24
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "risk"],
                0.58, 0.08,
                1, 0.32
              ],
              "line-blur": 8,
            },
          });

          map.addLayer({
            id: "gtfs-failure-lines",
            type: "line",
            source: "gtfs-failure-src",
            paint: {
              "line-color": [
                "case",
                [">=", ["get", "risk"], 0.9], "#ff006e",
                [">=", ["get", "risk"], 0.75], "#ff4d6d",
                "#ff85a1"
              ],
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "risk"],
                0.58, 2,
                1, 7
              ],
              "line-opacity": 0.95,
              "line-dasharray": [0.8, 1.2],
            },
          });

          const resilienceFeatures = gtfsHighlightFeatures
            .map((feature: any) => {
              const severity =
                typeof feature.properties?.severity === "number"
                  ? feature.properties.severity
                  : 0;

              const linkedFailure = failureForecastFeatures.find((f: any) =>
                f.properties?.route === feature.properties?.route
              );

              const risk =
                typeof linkedFailure?.properties?.risk === "number"
                  ? linkedFailure.properties.risk
                  : 0;

              const rerouteBoost = rerouteFeatures.length > 0 ? 0.22 : 0;

              const resilience = Math.max(
                0,
                Math.min(1, 1 - severity * 0.45 - risk * 0.4 + rerouteBoost)
              );

              return {
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  resilience,
                },
              };
            });

          map.addSource("gtfs-resilience-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: resilienceFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-resilience-lines",
            type: "line",
            source: "gtfs-resilience-src",
            paint: {
              "line-color": [
                "case",
                [">=", ["get", "resilience"], 0.8], "#22c55e",
                [">=", ["get", "resilience"], 0.6], "#84cc16",
                [">=", ["get", "resilience"], 0.4], "#facc15",
                [">=", ["get", "resilience"], 0.25], "#f97316",
                "#ef4444"
              ],
              "line-width": 1.5,
              "line-opacity": 0.5,
            },
          });

          const heatfieldFeatures = stopLinkedDisruptions
            .map((d: any) => {
              const coord = inspectorCity.MAP?.locations?.[d.location];
              if (!Array.isArray(coord)) return null;

              const severity =
                typeof d.effectiveSeverity === "number"
                  ? d.effectiveSeverity
                  : typeof d.severity === "number"
                  ? d.severity
                  : 0.5;

              return {
                type: "Feature",
                properties: {
                  intensity: Math.min(1, severity + failureForecastFeatures.length * 0.06),
                },
                geometry: {
                  type: "Point",
                  coordinates: coord,
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-heatfield-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: heatfieldFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-heatfield",
            type: "heatmap",
            source: "gtfs-heatfield-src",
            paint: {
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", "intensity"],
                0, 0,
                1, 1
              ],
              "heatmap-intensity": 1.3,
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 20,
                14, 55
              ],
              "heatmap-opacity": 0.55,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0, "rgba(34,197,94,0)",
                0.2, "#22c55e",
                0.4, "#facc15",
                0.6, "#f97316",
                0.85, "#ef4444",
                1, "#ff006e"
              ],
            },
          });

          const recoveryFeatures = rerouteFeatures
            .map((feature: any) => {
              const severity =
                typeof feature.properties?.severity === "number"
                  ? feature.properties.severity
                  : 0.5;

              const recovery = Math.max(
                0,
                Math.min(1, 1 - severity * 0.55 + (hopVehicles.length > 0 ? 0.18 : 0))
              );

              return {
                ...feature,
                properties: {
                  ...(feature.properties || {}),
                  recovery,
                },
              };
            })
            .filter(Boolean);

          map.addSource("gtfs-recovery-src", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: recoveryFeatures,
            },
          });

          map.addLayer({
            id: "gtfs-recovery-glow",
            type: "line",
            source: "gtfs-recovery-src",
            paint: {
              "line-color": "#22c55e",
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "recovery"],
                0, 0,
                1, 16
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["get", "recovery"],
                0, 0,
                1, 0.24
              ],
              "line-blur": 6,
            },
          });

          map.addLayer({
            id: "gtfs-recovery-lines",
            type: "line",
            source: "gtfs-recovery-src",
            paint: {
              "line-color": [
                "case",
                [">=", ["get", "recovery"], 0.75], "#22c55e",
                [">=", ["get", "recovery"], 0.5], "#84cc16",
                "#facc15"
              ],
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "recovery"],
                0, 1,
                1, 5
              ],
              "line-opacity": 0.95,
              "line-dasharray": [1.5, 1],
            },
          });

          map.addLayer({
            id: "gtfs-passenger-flow",
            type: "line",
            source: "gtfs-passenger-flow-src",
            paint: {
              "line-color": "#ffffff",
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "load"],
                0.4, 1,
                1, 4
              ],
              "line-opacity": 0.9,
              "line-dasharray": [0.5, 1.5],
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });

          map.addLayer({
            id: "gtfs-stress-lines",
            type: "line",
            source: "gtfs-stress-src",
            paint: {
              "line-color": [
                "case",
                [">=", ["get", "stress"], 0.85], "#dc2626",
                [">=", ["get", "stress"], 0.65], "#f97316",
                "#facc15"
              ],
              "line-width": [
                "interpolate",
                ["linear"],
                ["get", "stress"],
                0.35, 2,
                1, 6
              ],
              "line-opacity": 0.86,
              "line-dasharray": [1, 1.2],
            },
          });

          map.addLayer({
            id: "gtfs-impact-pulse",
            type: "circle",
            source: "gtfs-impact-pulse-src",


            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "severity"],
                0.45, 18,
                1, 42
              ],
              "circle-color": [
                "case",
                [">=", ["get", "severity"], 0.85], "#ef4444",
                [">=", ["get", "severity"], 0.6], "#f97316",
                "#facc15"
              ],
              "circle-opacity": 0.22,
              "circle-blur": 1.2,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-opacity": 0.45,
            },
          });


          map.addLayer({
            id: "gtfs-stops-layer",
            type: "circle",
            source: "gtfs-stops-src",
            minzoom: 12,
            paint: {
              "circle-radius": 2.5,
              "circle-color": "#f8fafc",
              "circle-opacity": 0.45,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#0f172a",
            },
          });

          map.addLayer({
            id: "gtfs-stops-hit-layer",
            type: "circle",
            source: "gtfs-stops-src",
            minzoom: 12,
            paint: {
              "circle-radius": 10,
              "circle-color": "#ffffff",
              "circle-opacity": 0.01,
              "circle-stroke-width": 0,
            },
          });


          map.addLayer({
            id: "disruption-points",
            type: "circle",
            source: "disruption-points-src",
            paint: {
              "circle-radius": [
                "case",
                ["==", ["get", "selected"], 1],
                20,
                ["==", ["get", "dimmed"], 1],
                7,
                12,
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "displaySeverity"], ["get", "effectiveSeverity"], 1],
                0.0, "#22c55e",
                0.35, "#eab308",
                0.65, "#f59e0b",
                0.9, "#ef4444"
              ],
              "circle-opacity": 0.55,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#e2e8f0",
            },
          });

          map.addSource("transit-stops-src", {
            type: "geojson",
            data: ensureFeatureCollection(stopData) as any,
          });

          map.addLayer({
            id: "transit-stops",
            type: "circle",
            source: "transit-stops-src",
            paint: {
              "circle-radius": [
                "case",
                ["==", ["get", "selectedStop"], 1],
                5.2,
                ["==", ["get", "selectedLine"], 1],
                3.5,
                2.2
              ],
              "circle-color": [
                "case",
                ["==", ["get", "selectedStop"], 1],
                "#f8fafc",
                "#cbd5e1"
              ],
              "circle-opacity": [
                "case",
                ["==", ["get", "selectedStop"], 1],
                1,
                ["==", ["get", "selectedLine"], 1],
                0.9,
                0.4
              ],
              "circle-stroke-width": [
                "case",
                ["==", ["get", "selectedStop"], 1],
                2,
                1
              ],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "selectedStop"], 1],
                "#2563eb",
                "#0f172a"
              ],
            },
          });

          map.addSource("transit-endpoints-src", {
            type: "geojson",
            data: ensureFeatureCollection(endpointData) as any,
          });

          map.addSource("selected-impact-zone-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedImpactZoneData) as any,
          });

          map.addSource("selected-affected-area-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedAffectedAreaData) as any,
          });

          map.addSource("selected-stops-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedStopData) as any,
          });

          map.addSource("selected-corridor-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedCorridorData) as any,
          });

          map.addSource("selected-proposal-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedProposalData) as any,
          });

          map.addSource("selected-proposal-point-src", {
            type: "geojson",
            data: ensureFeatureCollection(selectedProposalPointData) as any,
          });

          setGeoJsonSource(map, "accepted-interventions-src", acceptedInterventionData);

          map.addLayer({
            id: "transit-endpoints",
            type: "circle",
            source: "transit-endpoints-src",
            paint: {
              "circle-radius": 4.5,
              "circle-color": "#f8fafc",
              "circle-opacity": 0.9,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#111827",
            },
          });

          map.addLayer({
            id: "transit-endpoint-labels",
            type: "symbol",
            source: "transit-endpoints-src",
            layout: {
              "text-field": ["get", "label"],
              "text-size": 10,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#e2e8f0",
              "text-halo-color": "#0f172a",
              "text-halo-width": 1,
            },
          });

          map.addLayer({
            id: "selected-corridor",
            type: "line",
            source: "selected-corridor-src",
            paint: {
              "line-color": "#22d3ee",
              "line-width": 7,
              "line-opacity": 0.95,
              "line-blur": 1.2,
            },
          });

          if (map.getLayer("accepted-intervention-line")) {
            map.removeLayer("accepted-intervention-line");
          }
          if (map.getLayer("accepted-intervention-glow")) {
            map.removeLayer("accepted-intervention-glow");
          }

          map.addLayer({
            id: "accepted-intervention-glow",
            type: "line",
            source: "accepted-interventions-src",
            paint: {
              "line-color": "#86efac",
              "line-width": 13,
              "line-opacity": 0.32,
              "line-blur": 4,
            },
          });

          map.addLayer({
            id: "accepted-intervention-line",
            type: "line",
            source: "accepted-interventions-src",
            paint: {
              "line-color": "#64748b",
              "line-width": 5,
              "line-opacity": 0.55,
              "line-blur": 0.2,
            },
          });

          map.addLayer({
            id: "selected-proposal-glow",
            type: "line",
            source: "selected-proposal-src",
            paint: {
              "line-color": "#f0abfc",
              "line-width": 16,
              "line-opacity": 0.45,
              "line-blur": 4,
            },
          });

          map.addLayer({
            id: "selected-proposal-line",
            type: "line",
            source: "selected-proposal-src",
            paint: {
              "line-color": "#e879f9",
              "line-width": 8,
              "line-opacity": 1,
              "line-blur": 0.4,
            },
          });

          map.addLayer({
            id: "selected-proposal-point",
            type: "circle",
            source: "selected-proposal-point-src",
            paint: {
              "circle-radius": 12,
              "circle-color": "#e879f9",
              "circle-opacity": 0.95,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#fdf4ff",
            },
          });

          map.addLayer({
            id: "selected-impact-zone",
            type: "circle",
            source: "selected-impact-zone-src",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "affectedPax"], 0],
                0, 32,
                1000, 48,
                5000, 72,
                10000, 96
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "displaySeverity"], 1],
                0.0, "#22c55e",
                0.35, "#eab308",
                0.65, "#f59e0b",
                0.9, "#ef4444"
              ],
              "circle-opacity": 0.18,
              "circle-blur": 0.65,
              "circle-radius-transition": { duration: 450, delay: 0 },
              "circle-color-transition": { duration: 450, delay: 0 },
              "circle-opacity-transition": { duration: 450, delay: 0 },
            },
          });

          map.addLayer({
            id: "selected-impact-core",
            type: "circle",
            source: "selected-impact-zone-src",
            paint: {
              "circle-radius": 10,
              "circle-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "displaySeverity"], 1],
                0.0, "#22c55e",
                0.35, "#eab308",
                0.65, "#f59e0b",
                0.9, "#ef4444"
              ],
              "circle-opacity": 0.95,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#f8fafc",
            },
          });

          map.addLayer({
            id: "selected-affected-area",
            type: "line",
            source: "selected-affected-area-src",
            paint: {
              "line-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "displaySeverity"], ["get", "effectiveSeverity"], 1],
                0.0, "#22c55e",
                0.35, "#eab308",
                0.65, "#f59e0b",
                0.9, "#ef4444"
              ],
              "line-width": 5,
              "line-opacity": 0.75,
              "line-blur": 0.6,
              "line-dasharray": [1.2, 0.8],
            },
          });

          map.addLayer({
            id: "selected-stops",
            type: "circle",
            source: "selected-stops-src",
            paint: {
              "circle-radius": 8,
              "circle-color": "#facc15",
              "circle-opacity": 0.98,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#111827",
            },
          });

          map.addLayer({
            id: "selected-stop-labels",
            type: "symbol",
            source: "selected-stops-src",
            layout: {
              "text-field": ["get", "name"],
              "text-size": 10,
              "text-offset": [0, 1.15],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#f8fafc",
              "text-halo-color": "#0f172a",
              "text-halo-width": 1.2,
            },
          });
        } catch (err: any) {
          setError(err?.message || "Render failed");
        }
      }

      map.on("load", render);

      map.on("click", (event: any) => {
        const layers = ["disruption-points", "disruption-lines"].filter((layerId) =>
          map.getLayer(layerId)
        );

        if (layers.length === 0) return;

        const features = map.queryRenderedFeatures(event.point, { layers });
        const props = features?.[0]?.properties || {};
        const id = props.id || props.disruptionId || props.sourceId || props.name;

        console.log("Clicked disruption feature", props, "resolved id:", id);

        if (!id) return;

        setSelectedId(String(id));
        setInspectorDisruptionId(String(id));
      });

      map.on("mousemove", (event: any) => {
        const layers = ["disruption-points", "disruption-lines"].filter((layerId) =>
          map.getLayer(layerId)
        );

        if (layers.length === 0) {
          map.getCanvas().style.cursor = "";
          return;
        }

        const features = map.queryRenderedFeatures(event.point, { layers });
        map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
      });

      map.on("mouseleave", () => {
        map.getCanvas().style.cursor = "";
      });

      const rerender = () => {
        const city = getCityData();
        const map = mapRef.current;
        const boundary = getMunicipalityBoundaryForCity(city.CITY_CONFIG.id);
        const bounds = boundaryBounds(boundary);

        if (map && bounds) {
          map.fitBounds(bounds, {
            padding: 72,
            duration: 1100,
            essential: true,
          });
        } else if (map && city?.MAP?.center) {
          map.flyTo({
            center: city.MAP.center,
            zoom: city.MAP.zoom || 12,
            duration: 900,
            essential: true,
          });
        }

        renderMapRef.current?.();
      };

      const unsubCity = subscribeCity(rerender);
      const unsubSelection = subscribeSelection(rerender);
      const unsubTimeline = subscribeTimeline(rerender);
      const unsubInterventions = subscribeInterventions(rerender);
      const unsubTraffic = subscribeLiveTraffic(rerender);
      const unsubRoads = subscribeRoadGeometry(rerender);
      const unsubProposal = subscribeProposalSelection(rerender);

      mapRef.current = map;

      return () => {
        unsubCity();
        unsubSelection();
        unsubTimeline();
        unsubInterventions();
        unsubTraffic();
        unsubRoads();
        unsubProposal();
        map.remove();
        mapRef.current = null;
        renderMapRef.current = null;
      };
    } catch (err: any) {
      setError(err?.message || "Map initialization failed");
    }
  }, []);

  useEffect(() => {
    const unsubTimelineUi = subscribeTimeline(() => {
      setTimelineUiState(getTimelineState());
    });
    return unsubTimelineUi;
  }, []);

  void inspectorVersion;

  const inspectorCity = getCityData();
  const inspectorAcceptedIds = getAccepted();

  const opsAcceptedProposals = inspectorAcceptedIds
    .map((id: string) =>
      (inspectorCity.INTERVENTIONS || []).find((proposal: any) => String(proposal.id) === String(id))
    )
    .filter(Boolean);

  const opsTotalPaxMinutesSaved = opsAcceptedProposals.reduce(
    (sum: number, proposal: any) =>
      sum + Number(proposal.passengerMinutesSaved || proposal.paxMinutesSaved || 0),
    0
  );

  const inspectorSim = getSimulationState(
    inspectorCity.CITY_CONFIG.id,
    getTimelineState().currentMinute
  );

  const inspectorDisruptionsWithEffects = applyInterventionEffects(
    inspectorSim.disruptions,
    inspectorCity,
    inspectorAcceptedIds
  );

  const inspectorBaseDisruption = inspectorDisruptionId
    ? (
        inspectorSim.disruptions.find((d: any) => String(d.id) === String(inspectorDisruptionId)) ||
        inspectorCity.DISRUPTIONS.find((d: any) => String(d.id) === String(inspectorDisruptionId))
      )
    : null;

  const inspectorDisruption = inspectorDisruptionId
    ? (
        inspectorDisruptionsWithEffects.find((d: any) => String(d.id) === String(inspectorDisruptionId)) ||
        inspectorBaseDisruption
      )
    : null;

  const aiCandidateProposals = inspectorDisruption
    ? (inspectorCity.INTERVENTIONS || []).filter(
        (proposal: any) => String(proposal.disruptionId) === String(inspectorDisruption.id)
      )
    : [];

  const aiRankedInterventions = rankInterventionsForDisruption({
    proposals: aiCandidateProposals,
    appliedIds: inspectorAcceptedIds,
  });

  const aiBestAction = aiRankedInterventions[0] || null;

  const aiPlan = planInterventionSequence({
    proposals: aiCandidateProposals,
    appliedIds: inspectorAcceptedIds,
    maxSteps: 3,
  });

  useEffect(() => {
    if (aiControlMode !== "auto") return;
    if (!inspectorDisruption || !aiBestAction?.proposal) return;

    const disruptionId = String(inspectorDisruption.id);
    if (lastAutoAppliedDisruptionRef.current === disruptionId) return;

    const timer = window.setTimeout(() => {
      acceptIntervention(String(aiBestAction.proposal.id), {
        disruptionId: aiBestAction.proposal.disruptionId,
        snapshot: {
          source: "ai_auto_mode",
          score: aiBestAction.score,
          reasons: aiBestAction.reasons,
        },
      });

      lastAutoAppliedDisruptionRef.current = disruptionId;
      setSelectedProposalId(null);
      setInspectorVersion((v) => v + 1);
      renderMapRef.current?.();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [aiControlMode, inspectorDisruption?.id, aiBestAction?.proposal?.id]);

  const inspectorBaseSeverity =
    typeof inspectorBaseDisruption?.effectiveSeverity === "number"
      ? inspectorBaseDisruption.effectiveSeverity
      : typeof inspectorBaseDisruption?.severity === "number"
      ? inspectorBaseDisruption.severity
      : 1;

  const inspectorEffectiveSeverity =
    typeof inspectorDisruption?.effectiveSeverity === "number"
      ? inspectorDisruption.effectiveSeverity
      : inspectorBaseSeverity;

  const inspectorSeverityDelta = inspectorEffectiveSeverity - inspectorBaseSeverity;

  const inspectorHop = inspectorDisruption
    ? scoreHopAvailability(
        inspectorCity.CITY_CONFIG.id,
        inspectorCity.MAP?.locations?.[inspectorDisruption.location] || null,
        500
      )
    : null;

  const inspectorProposals = inspectorDisruption
    ? (inspectorCity.INTERVENTIONS || []).filter(
        (proposal: any) => String(proposal.disruptionId) === String(inspectorDisruption.id)
      )
    : [];

  const inspectorAcceptedForDisruption = inspectorProposals
    .filter((proposal: any) => inspectorAcceptedIds.includes(String(proposal.id)));

  const inspectorAppliedProposals = inspectorAcceptedForDisruption;

  const selectedStopRoutes = Array.isArray(selectedGtfsStop?.routes)
    ? selectedGtfsStop.routes.map(String)
    : [];

  const stopLinkedDisruptions = selectedGtfsStop
    ? inspectorDisruptionsWithEffects.filter((disruption: any) => {
        const parts = [
          disruption.id,
          disruption.title,
          disruption.name,
          disruption.line,
          disruption.route,
          disruption.routeShortName,
          disruption.source?.line,
          disruption.source?.route,
          disruption.source?.routeShortName,
        ]
          .filter(Boolean)
          .map(String);

        return selectedStopRoutes.some((route: string) =>
          parts.some((part: string) => part.includes(route))
        );
      })
    : [];

  const stopLinkedDisruptionIds = new Set(
    stopLinkedDisruptions.map((disruption: any) => String(disruption.id))
  );

  const directlyLinkedStopProposals = selectedGtfsStop
    ? (inspectorCity.INTERVENTIONS || []).filter((proposal: any) => {
        if (stopLinkedDisruptionIds.has(String(proposal.disruptionId))) return true;

        const parts = [
          proposal.id,
          proposal.title,
          proposal.action,
          proposal.description,
          proposal.rationale,
          proposal.line,
          proposal.route,
          ...(Array.isArray(proposal.resources) ? proposal.resources : []),
        ]
          .filter(Boolean)
          .map(String);

        return selectedStopRoutes.some((route: string) =>
          parts.some((part: string) => part.includes(route))
        );
      })
    : [];

  const stopResilienceScore = selectedGtfsStop
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            100 -
              stopLinkedDisruptions.reduce((sum: number, d: any) => {
                const sev =
                  typeof d.effectiveSeverity === "number"
                    ? d.effectiveSeverity
                    : typeof d.severity === "number"
                    ? d.severity
                    : 0;
                return sum + sev * 18;
              }, 0) +
              (directlyLinkedStopProposals.length > 0 ? 12 : 0)
          )
        )
      )
    : null;

  const nearestStopDisruption = selectedGtfsStop
    ? inspectorDisruptionsWithEffects
        .map((disruption: any) => {
          const disruptionCoord = inspectorCity.MAP?.locations?.[disruption.location];
          const stopCoord = selectedGtfsStop.coordinates;

          const distance =
            isValidCoord(disruptionCoord) && isValidCoord(stopCoord)
              ? distanceMeters(stopCoord, disruptionCoord)
              : Infinity;

          const severity =
            typeof disruption.effectiveSeverity === "number"
              ? disruption.effectiveSeverity
              : typeof disruption.severity === "number"
              ? disruption.severity
              : 0.5;

          const passengerImpact = Number(
            disruption.affectedPassengers ||
              disruption.passengerImpact ||
              disruption.paxAffected ||
              0
          );

          const distanceScore = Number.isFinite(distance)
            ? Math.max(0, 100 - distance / 35)
            : 0;

          const severityScore = severity * 100;
          const passengerScore = Math.min(100, passengerImpact / 50);

          return {
            disruption,
            distance,
            fallbackScore:
              distanceScore * 0.45 +
              severityScore * 0.4 +
              passengerScore * 0.15,
          };
        })
        .sort((a: any, b: any) => b.fallbackScore - a.fallbackScore)[0]
    : null;

  const fallbackStopProposals =
    directlyLinkedStopProposals.length === 0 && nearestStopDisruption?.disruption
      ? (inspectorCity.INTERVENTIONS || []).filter(
          (proposal: any) =>
            String(proposal.disruptionId) === String(nearestStopDisruption.disruption.id)
        )
      : [];

  const stopCandidateProposals =
    directlyLinkedStopProposals.length > 0
      ? directlyLinkedStopProposals
      : fallbackStopProposals;

  const stopAiRankedInterventions = rankInterventionsForDisruption({
    proposals: stopCandidateProposals,
    appliedIds: inspectorAcceptedIds,
  });

  const stopAiConfidence = selectedGtfsStop
    ? Math.max(
        12,
        Math.min(
          98,
          Math.round(
            (
              directlyLinkedStopProposals.length * 18 +
              stopLinkedDisruptions.length * 11 +
              (nearestStopDisruption ? 14 : 0)
            ) *
              (
                stopResilienceScore !== null
                  ? 1 - stopResilienceScore / 160
                  : 1
              )
          )
        )
      )
    : null;

  const stopAiBestAction = stopAiRankedInterventions[0] || null;

  const inspectorMmStats = inspectorDisruption
    ? getNearbyMmOperatorStats(inspectorCity, { disruptions: inspectorDisruptionsWithEffects }, inspectorDisruption, 600)
    : [];

  useEffect(() => {
    if (aiControlMode !== "auto") return;

    const city = getCityData();
    const sim = getSimulationState();
    const acceptedIds = getAccepted();

    const disruptions = sim?.disruptions || city?.DISRUPTIONS || [];
    const proposals = city?.INTERVENTIONS || [];

    const ranked = disruptions
      .map((disruption: any) => {
        const related = proposals.filter(
          (proposal: any) => String(proposal.disruptionId) === String(disruption.id)
        );

        const rankedActions = rankInterventionsForDisruption({
          proposals: related,
          appliedIds: acceptedIds,
        });

        const best = rankedActions[0];

        if (!best) return null;

        const severity =
          typeof disruption.effectiveSeverity === "number"
            ? disruption.effectiveSeverity
            : typeof disruption.severity === "number"
            ? disruption.severity
            : 0.5;

        return {
          disruption,
          best,
          priority: best.score + severity * 35,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.priority - a.priority);

    const top = ranked[0];
    if (!top?.best?.proposal?.id) return;

    if (lastAutoAppliedDisruptionRef.current === String(top.disruption.id)) return;

    acceptIntervention(String(top.best.proposal.id), {
      disruptionId: top.best.proposal.disruptionId,
      snapshot: {
        source: "autopilot_dispatcher",
        disruptionId: top.disruption.id,
        disruptionTitle: top.disruption.title || top.disruption.name || top.disruption.id,
        proposalId: top.best.proposal.id,
        score: top.best.score,
        priority: top.priority,
        reasons: top.best.reasons,
        timestamp: Date.now(),
      },
    });

    lastAutoAppliedDisruptionRef.current = String(top.disruption.id);

    setAutopilotLog((items) => [
      {
        id: `${top.disruption.id}-${top.best.proposal.id}-${Date.now()}`,
        disruption: top.disruption.title || top.disruption.name || top.disruption.id,
        action: top.best.proposal.action || top.best.proposal.title || top.best.proposal.id,
        score: top.best.score,
        priority: Math.round(top.priority),
        reasons: top.best.reasons || [],
      },
      ...items,
    ].slice(0, 6));

    setInspectorVersion((v) => v + 1);
    renderMapRef.current?.();
  }, [aiControlMode, inspectorVersion]);

  const bestNextProposal =
    inspectorProposals
      .filter((proposal: any) => !inspectorAcceptedIds.includes(String(proposal.id)))
      .slice()
      .sort((a: any, b: any) => {
        const aMm = getMmPlanSummary(inspectorCity, { disruptions: inspectorDisruptionsWithEffects }, a, 600);
        const bMm = getMmPlanSummary(inspectorCity, { disruptions: inspectorDisruptionsWithEffects }, b, 600);

        const aMmBoost = aMm ? aMm.availableTotal * 4 : 0;
        const bMmBoost = bMm ? bMm.availableTotal * 4 : 0;

        const aScore =
          Number(a.adjustedConfidence || a.confidence || 0) +
          Number(a.passengerMinutesSaved || a.paxMinutesSaved || 0) / 10 +
          aMmBoost;

        const bScore =
          Number(b.adjustedConfidence || b.confidence || 0) +
          Number(b.passengerMinutesSaved || b.paxMinutesSaved || 0) / 10 +
          bMmBoost;

        return bScore - aScore;
      })[0] || null;

  const startPanelDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    panel: "focus" | "ops"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = panel === "focus" ? focusPanelPos : opsPanelPos;

    const onMove = (moveEvent: MouseEvent) => {
      const next = {
        x: Math.max(8, startPos.x + moveEvent.clientX - startX),
        y: Math.max(8, startPos.y + moveEvent.clientY - startY),
      };

      if (panel === "focus") {
        setFocusPanelPos(next);
      } else {
        setOpsPanelPos(next);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      style={{
        position: mapExpanded ? "fixed" : "relative",
        inset: mapExpanded ? 0 : undefined,
        width: "100%",
        height: mapExpanded ? "100vh" : "100%",
        minHeight: 260,
        background: "#111827",
        zIndex: mapExpanded ? 99999 : undefined,
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          const next = !showAllMmRef.current;
          showAllMmRef.current = next;
          setShowAllMm(next);
          renderMapRef.current?.();
        }}
        title={showAllMm ? "Manual MM override ON — click to return to contextual MM" : "Manual MM override OFF — click to show all MM dots"}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 30,
          padding: "6px 10px",
          borderRadius: 8,
          background: showAllMm ? "rgba(6,78,59,0.94)" : "rgba(15,23,42,0.92)",
          color: "#fff",
          fontSize: 12,
          border: showAllMm ? "1px solid #22c55e" : "1px solid #475569",
          cursor: "pointer",
          boxShadow: showAllMm ? "0 0 0 2px rgba(34,197,94,0.14)" : "none",
        }}
      >
        <span style={{ color: "#fca5a5", fontWeight: 700 }}>HOP {mmDebugCounts.hop}</span>
        <span style={{ color: "#64748b" }}> · </span>
        <span style={{ color: "#93c5fd", fontWeight: 700 }}>Dott {mmDebugCounts.dott}</span>
        <span style={{ color: "#64748b" }}> · </span>
        <span style={{ color: "#86efac", fontWeight: 700 }}>Lime {mmDebugCounts.lime}</span>
        <span style={{ color: showAllMm ? "#bbf7d0" : "#94a3b8", marginLeft: 8, fontWeight: 900 }}>
          {showAllMm ? "ALL" : "CTX"}
        </span>
      </button>

      <div
        style={{
          position: "absolute",
          top: 142,
          left: 12,
          zIndex: 10004,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = !mapExpanded;
            setMapExpanded(next);
            setTimeout(() => {
              mapRef.current?.resize();
              renderMapRef.current?.();
            }, 80);
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: "1px solid #475569",
            background: "rgba(15,23,42,0.94)",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {mapExpanded ? "Exit full map" : "Full map"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowFocusPanel((v) => !v);
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: showFocusPanel ? "1px solid #38bdf8" : "1px solid #475569",
            background: showFocusPanel ? "#082f49" : "rgba(15,23,42,0.94)",
            color: showFocusPanel ? "#bae6fd" : "#e2e8f0",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Focus
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowOpsPanel((v) => !v);
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: showOpsPanel ? "1px solid #22c55e" : "1px solid #475569",
            background: showOpsPanel ? "#052e16" : "rgba(15,23,42,0.94)",
            color: showOpsPanel ? "#bbf7d0" : "#e2e8f0",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Ops
        </button>
      </div>

      <div
        onMouseDown={(e) => startPanelDrag(e, "focus")}
        title="Drag to move"
        style={{
          position: "absolute",
          left: 12,
          top: 58,
          zIndex: 10003,
          padding: 6,
          borderRadius: 10,
          background: "rgba(15,23,42,0.94)",
          color: "#fff",
          fontSize: 12,
          border: "1px solid #475569",
          display: "flex",
          gap: 6,
          alignItems: "center",
          cursor: "move",
          userSelect: "none",
        }}
      >
        <button
          type="button"
          onClick={() => {
            showAppliedPreviewRef.current = false;
            setShowAppliedPreview(false);
            renderMapRef.current?.();
          }}
          style={{
            padding: "6px 9px",
            borderRadius: 8,
            border: showAppliedPreview ? "1px solid #334155" : "1px solid #f97316",
            background: showAppliedPreview ? "#020617" : "#431407",
            color: showAppliedPreview ? "#cbd5e1" : "#fed7aa",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Current
        </button>

        <button
          type="button"
          onClick={() => {
            showAppliedPreviewRef.current = true;
            setShowAppliedPreview(true);
            renderMapRef.current?.();
          }}
          style={{
            padding: "6px 9px",
            borderRadius: 8,
            border: showAppliedPreview ? "1px solid #16a34a" : "1px solid #334155",
            background: showAppliedPreview ? "#052e16" : "#020617",
            color: showAppliedPreview ? "#86efac" : "#cbd5e1",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          With applied
        </button>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !showAllMmRef.current;
          showAllMmRef.current = next;
          setShowAllMm(next);
          renderMapRef.current?.();
        }}
        style={{
          position: "absolute",
          top: 100,
          left: 12,
          zIndex: 10004,
          padding: "7px 10px",
          borderRadius: 10,
          border: showAllMm ? "1px solid #38bdf8" : "1px solid #475569",
          background: showAllMm ? "#082f49" : "rgba(15,23,42,0.94)",
          color: showAllMm ? "#bae6fd" : "#e2e8f0",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        HOP {mmDebugCounts.hop} · Dott {mmDebugCounts.dott} · Lime {mmDebugCounts.lime}
      </button>

      <div
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          zIndex: 10003,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 6,
          borderRadius: 10,
          background: "rgba(15,23,42,0.94)",
          border: "1px solid #475569",
          color: "#e2e8f0",
          fontSize: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            stepBackward(5);
            renderMapRef.current?.();
          }}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#020617",
            color: "#cbd5e1",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          -5m
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (timelineUiState.isPlaying) {
              pause();
            } else {
              play();
            }
            renderMapRef.current?.();
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: timelineUiState.isPlaying ? "1px solid #f59e0b" : "1px solid #16a34a",
            background: timelineUiState.isPlaying ? "#431407" : "#052e16",
            color: timelineUiState.isPlaying ? "#fed7aa" : "#86efac",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {timelineUiState.isPlaying ? "Pause" : "Play scenario"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            stepForward(5);
            renderMapRef.current?.();
          }}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#020617",
            color: "#cbd5e1",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          +5m
        </button>

        <span style={{ color: "#f8fafc", fontWeight: 900, minWidth: 42, textAlign: "center" }}>
          {formatMinute(timelineUiState.currentMinute)}
        </span>
      </div>

      {showFocusPanel && (
      <div
        onMouseDown={(e) => startPanelDrag(e, "focus")}
        title="Drag to move"
        style={{
          position: "absolute",
          left: focusPanelPos.x,
          top: focusPanelPos.y,
          zIndex: 10002,
          padding: 6,
          borderRadius: 10,
          background: "rgba(15,23,42,0.94)",
          color: "#fff",
          fontSize: 12,
          border: "1px solid #475569",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 176,
          cursor: "move",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 900, letterSpacing: 0.6 }}>
          FOCUS MODE
        </div>

        {[
          ["all", "All disruptions"],
          ["selected", "Selected disruption"],
          ["applied", "Applied strategy"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const nextMode = mode as "all" | "selected" | "applied";
              focusModeRef.current = nextMode;
              setFocusMode(nextMode);

              // Clear hover/proposal preview so focus mode controls the map.
              setSelectedProposalId(null);

              renderMapRef.current?.();
            }}
            style={{
              padding: "6px 9px",
              borderRadius: 8,
              border: focusMode === mode ? "1px solid #38bdf8" : "1px solid #334155",
              background: focusMode === mode ? "#082f49" : "#020617",
              color: focusMode === mode ? "#bae6fd" : "#cbd5e1",
              fontWeight: 900,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {label}
          </button>
        ))}

        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.35 }}>
          All = clean view. Selected/Applied = nearby available MM context.
        </div>
      </div>
      )}

      {showOpsPanel && (
      <div
        onMouseDown={(e) => startPanelDrag(e, "ops")}
        title="Drag to move"
        style={{
          position: "absolute",
          left: opsPanelPos.x,
          top: opsPanelPos.y,
          zIndex: 10001,
          width: 300,
          maxHeight: "52%",
          overflowY: "auto",
          padding: 10,
          borderRadius: 12,
          background: "rgba(15,23,42,0.94)",
          color: "#e2e8f0",
          fontSize: 11,
          border: "1px solid #475569",
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
          cursor: "move",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.6, color: "#f8fafc" }}>
            OPS VISUAL SYSTEM
          </div>
          <div
            style={{
              border: showAppliedPreview ? "1px solid #166534" : "1px solid #9a3412",
              background: showAppliedPreview ? "#052e16" : "#431407",
              color: showAppliedPreview ? "#86efac" : "#fed7aa",
              borderRadius: 999,
              padding: "2px 7px",
              fontWeight: 900,
            }}
          >
            {showAppliedPreview ? "APPLIED" : "CURRENT"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["#ef4444", "Critical"],
            ["#f59e0b", "High"],
            ["#eab308", "Moderate"],
            ["#22c55e", "Improved"],
          ].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: color,
                  boxShadow: `0 0 12px ${color}`,
                }}
              />
              <span style={{ color: "#cbd5e1" }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "#334155", margin: "9px 0" }} />

        <div style={{ background: "#020617", border: "1px solid #1e40af", borderRadius: 10, padding: 8, marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <span style={{ color: "#93c5fd", fontWeight: 900 }}>AI best action</span>
            <span style={{ color: "#bfdbfe", fontWeight: 900 }}>
              {aiControlMode === "off" ? "OFF" : aiBestAction ? aiBestAction.score : "—"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
            {[
              ["off", "Off"],
              ["suggest", "Suggest"],
              ["auto", "Auto"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAiControlMode(mode as "off" | "suggest" | "auto");
                  if (mode !== "auto") {
                    lastAutoAppliedDisruptionRef.current = null;
                  }
                }}
                style={{
                  padding: "5px 6px",
                  borderRadius: 7,
                  border: aiControlMode === mode ? "1px solid #38bdf8" : "1px solid #334155",
                  background: aiControlMode === mode ? "#082f49" : "#020617",
                  color: aiControlMode === mode ? "#bae6fd" : "#94a3b8",
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {aiControlMode === "auto" && (
            <div style={{ marginBottom: 8, fontSize: 10, color: "#fde68a", lineHeight: 1.35 }}>
              AUTO applies the top recommendation once for the selected disruption.
            </div>
          )}

          {aiControlMode === "off" ? (
            <div style={{ color: "#64748b", fontSize: 10 }}>
              AI recommendations disabled.
            </div>
          ) : aiBestAction ? (
            <>
              <div style={{ color: "#e0f2fe", fontWeight: 900, lineHeight: 1.25 }}>
                {aiBestAction.proposal.action || aiBestAction.proposal.title || aiBestAction.proposal.id}
              </div>

              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                {aiBestAction.reasons.slice(0, 3).map((reason: string) => (
                  <div key={reason} style={{ color: "#94a3b8", fontSize: 10 }}>
                    • {reason}
                  </div>
                ))}
              </div>

              {aiBestAction?.metrics && (
                <div style={{
                  marginTop: 8,
                  padding: 6,
                  borderRadius: 8,
                  background: "#020617",
                  border: "1px solid #1e293b",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontSize: 10,
                }}>
                  <div style={{ color: "#94a3b8" }}>
                    Severity impact: 
                    <span style={{ color: "#86efac", fontWeight: 900 }}>
                      {" "}−{aiBestAction.metrics.severityReductionPts} pts
                    </span>
                  </div>

                  <div style={{ color: "#94a3b8" }}>
                    Recovery gain: 
                    <span style={{ color: "#86efac", fontWeight: 900 }}>
                      {" "}{aiBestAction.metrics.recoveryMinutesSaved} min faster
                    </span>
                  </div>

                  <div style={{ color: "#94a3b8" }}>
                    Passenger impact: 
                    <span style={{ color: "#86efac", fontWeight: 900 }}>
                      {" "}{aiBestAction.metrics.paxSaved.toLocaleString()} pax·min
                    </span>
                  </div>
                </div>
              )}

              {aiPlan.length > 1 && (
                <div style={{ marginTop: 8, padding: 7, borderRadius: 8, background: "#020617", border: "1px solid #334155" }}>
                  <div style={{ color: "#93c5fd", fontWeight: 900, fontSize: 10, marginBottom: 5 }}>
                    AI strategy plan
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {aiPlan.map((step: any, index: number) => (
                      <div key={step.proposal.id} style={{ color: "#cbd5e1", fontSize: 10, lineHeight: 1.3 }}>
                        {index + 1}. {step.proposal.action || step.proposal.title || step.proposal.id}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      aiPlan.forEach((step: any) => {
                        acceptIntervention(String(step.proposal.id), {
                          disruptionId: step.proposal.disruptionId,
                          snapshot: {
                            source: "ai_multi_step_plan",
                            score: step.score,
                            reasons: step.reasons,
                          },
                        });
                      });
                      setSelectedProposalId(null);
                      setInspectorVersion((v) => v + 1);
                      renderMapRef.current?.();
                    }}
                    style={{
                      marginTop: 7,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid #7c3aed",
                      background: "#2e1065",
                      color: "#ddd6fe",
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Apply full AI plan
                  </button>
                </div>
              )}

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  acceptIntervention(String(aiBestAction.proposal.id), {
                    disruptionId: aiBestAction.proposal.disruptionId,
                    snapshot: {
                      source: "ai_best_action",
                      score: aiBestAction.score,
                      reasons: aiBestAction.reasons,
                    },
                  });
                  setSelectedProposalId(null);
                  setInspectorVersion((v) => v + 1);
                  renderMapRef.current?.();
                }}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#172554",
                  color: "#bfdbfe",
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {aiControlMode === "auto" ? "Auto armed" : "Apply AI recommendation"}
              </button>
            </>
          ) : (
            <div style={{ color: "#64748b", fontSize: 10 }}>
              No remaining actions for selected disruption.
            </div>
          )}
        </div>

        <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 8, marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#94a3b8", fontWeight: 800 }}>Applied actions</span>
            <span style={{ color: "#86efac", fontWeight: 900 }}>{opsAcceptedProposals.length}</span>
          </div>

          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>
            Total saved: {Math.round(opsTotalPaxMinutesSaved).toLocaleString()} pax·min
          </div>

          {opsAcceptedProposals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {opsAcceptedProposals.slice(0, 4).map((proposal: any) => (
                <div
                  key={proposal.id}
                  style={{ border: "1px solid #14532d", background: "#052e16", borderRadius: 8, padding: 7 }}
                >
                  <div style={{ color: "#bbf7d0", fontWeight: 800, lineHeight: 1.25 }}>
                    {proposal.action || proposal.title || proposal.id}
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      rejectIntervention(String(proposal.id), { disruptionId: proposal.disruptionId });
                      setSelectedProposalId(null);
                      setInspectorVersion((v) => v + 1);
                      renderMapRef.current?.();
                    }}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      padding: "5px 7px",
                      borderRadius: 7,
                      border: "1px solid #166534",
                      background: "#022c22",
                      color: "#bbf7d0",
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  opsAcceptedProposals.forEach((proposal: any) => {
                    rejectIntervention(String(proposal.id), { disruptionId: proposal.disruptionId });
                  });
                  setSelectedProposalId(null);
                  setInspectorVersion((v) => v + 1);
                  renderMapRef.current?.();
                }}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #7f1d1d",
                  background: "#450a0a",
                  color: "#fecaca",
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Clear all applied
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, color: "#94a3b8" }}>
          <div>
            <span style={{ color: "#bae6fd", fontWeight: 900 }}>Focus:</span>{" "}
            {focusMode === "all" ? "All disruptions" : focusMode === "selected" ? "Selected disruption" : "Applied strategy"}
          </div>
          <div>
            <span style={{ color: "#bbf7d0", fontWeight: 900 }}>MM:</span>{" "}
            {showAllMm ? "All operators visible" : "Contextual nearby operators"}
          </div>
          <div>
            <span style={{ color: "#facc15", fontWeight: 900 }}>Yellow stops:</span>{" "}
            immediate affected area
          </div>
          <div>
            <span style={{ color: "#f0abfc", fontWeight: 900 }}>Magenta:</span>{" "}
            preview proposal corridor
          </div>
          <div>
            <span style={{ color: "#86efac", fontWeight: 900 }}>Green corridor:</span>{" "}
            accepted intervention
          </div>
        </div>
      </div>
      )}

      {inspectorDisruption && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            maxWidth: 560,
            minWidth: 360,
            height: "100%",
            zIndex: 9999,
            background: "rgba(15,23,42,0.97)",
            color: "#e2e8f0",
            borderLeft: "1px solid #334155",
            boxShadow: "-24px 0 60px rgba(0,0,0,0.45)",
            padding: 18,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 0.8 }}>
                DISRUPTION INSPECTOR
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
                {inspectorDisruption.title || inspectorDisruption.id}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {inspectorDisruption.id}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectorDisruptionId(null)}
              style={{
                background: "#1f2937",
                color: "#e5e7eb",
                border: "1px solid #475569",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                height: 34,
              }}
            >
              Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
            <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Line</div>
              <div style={{ fontWeight: 800 }}>{inspectorDisruption.line || inspectorDisruption.source?.line || "Unknown"}</div>
            </div>

            <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Mode</div>
              <div style={{ fontWeight: 800 }}>{inspectorDisruption.mode || inspectorDisruption.source?.mode || "Unknown"}</div>
            </div>

            <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Severity</div>
              <div style={{ fontWeight: 800 }}>{numberToSeverity(inspectorDisruption.effectiveSeverity ?? inspectorDisruption.severity ?? 1)}</div>
            </div>

            <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Location</div>
              <div style={{ fontWeight: 800 }}>{inspectorDisruption.location || "Unknown"}</div>
            </div>
          </div>

          <div style={{ marginTop: 18, background: "#020617", border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
              Cumulative impact
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ color: "#fca5a5", fontWeight: 800 }}>
                {Math.round(inspectorBaseSeverity * 100)}%
              </span>
              <span style={{ color: "#64748b" }}>→</span>
              <span style={{ color: inspectorEffectiveSeverity < inspectorBaseSeverity ? "#86efac" : "#e2e8f0", fontWeight: 900 }}>
                {Math.round(inspectorEffectiveSeverity * 100)}%
              </span>
              <span style={{ color: inspectorSeverityDelta < 0 ? "#86efac" : "#94a3b8", fontSize: 12 }}>
                ({inspectorSeverityDelta < 0 ? "" : "+"}{Math.round(inspectorSeverityDelta * 100)} pts)
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
              Applied interventions for this disruption: {inspectorAcceptedForDisruption.length}
            </div>
          </div>

          <div style={{ marginTop: 18, background: "#020617", border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
              MM availability near disruption
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {inspectorMmStats.map((stat: any) => (
                <span
                  key={stat.operator}
                  style={{
                    fontSize: 11,
                    border: stat.availableNearby > 0 ? "1px solid #166534" : "1px solid #334155",
                    background: stat.availableNearby > 0 ? "#052e16" : "#0f172a",
                    color: stat.availableNearby > 0 ? "#86efac" : "#cbd5e1",
                    borderRadius: 999,
                    padding: "4px 8px",
                    fontWeight: 800,
                  }}
                >
                  {formatMmOperatorLabel(stat.operator)} {stat.availableNearby}/{stat.totalNearby}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
              Operator-neutral rule: use whichever MM operators have available scooters closest to this disruption.
            </div>
          </div>

          {aiBestAction && (
            <div style={{ marginTop: 18, background: "#020617", border: "1px solid #1e40af", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#93c5fd" }}>
                  AI recommendation
                </div>
                <div style={{ fontSize: 11, color: "#bfdbfe", fontWeight: 900 }}>
                  Score {aiBestAction.score}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 900, color: "#e0f2fe", lineHeight: 1.3 }}>
                {aiBestAction.proposal.action || aiBestAction.proposal.title || aiBestAction.proposal.id}
              </div>

              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {aiBestAction.reasons.slice(0, 4).map((reason: string) => (
                  <div key={reason} style={{ fontSize: 12, color: "#94a3b8" }}>
                    • {reason}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  acceptIntervention(String(aiBestAction.proposal.id), {
                    disruptionId: aiBestAction.proposal.disruptionId,
                    snapshot: {
                      source: "ai_recommendation_inspector",
                      score: aiBestAction.score,
                      reasons: aiBestAction.reasons,
                    },
                  });
                  setSelectedProposalId(null);
                  setInspectorVersion((v) => v + 1);
                  renderMapRef.current?.();
                }}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#172554",
                  color: "#bfdbfe",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Apply AI recommendation
              </button>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 900, marginBottom: 8 }}>
              Recommended interventions
            </div>

            {bestNextProposal && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#86efac", fontWeight: 900 }}>
                Best next action: {bestNextProposal.action || bestNextProposal.title || bestNextProposal.id}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inspectorProposals.slice(0, 4).map((proposal: any) => {
                const isApplied = inspectorAcceptedIds.includes(String(proposal.id));
                const mmPlan = getMmPlanSummary(
                  inspectorCity,
                  { disruptions: inspectorDisruptionsWithEffects },
                  proposal,
                  600
                );
                const isBestNext = bestNextProposal && String(bestNextProposal.id) === String(proposal.id);

                const conflictRisk = detectConflictRisk(proposal, inspectorAppliedProposals);
                const diminishing = detectDiminishingReturns(proposal, inspectorAppliedProposals);

                const contribution = computeInterventionContribution(
                  proposal,
                  inspectorAppliedProposals
                );

                const toggleProposal = () => {
                  const id = String(proposal.id);

                  if (isApplied) {
                    rejectIntervention(id, {
                      disruptionId: inspectorDisruption?.id,
                    });
                  } else {
                    acceptIntervention(id, {
                      disruptionId: inspectorDisruption?.id,
                      snapshot: {
                        hopScore: inspectorHop?.score,
                        baseSeverity: inspectorBaseSeverity,
                        effectiveSeverity: inspectorEffectiveSeverity,
                      },
                    });
                  }

                  // Keep selected proposal only for hover-preview, not as a permanent map override.
                  setSelectedProposalId(null);
                  setInspectorVersion((v) => v + 1);
                  renderMapRef.current?.();
                };

                return (
                  <div
                    key={proposal.id}
                    onMouseEnter={() => setSelectedProposalId(String(proposal.id))}
                    onMouseLeave={() => {
                      setSelectedProposalId(null);
                      renderMapRef.current?.();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleProposal();
                    }}
                    title="Hover to preview, click to apply/remove"
                    style={{
                      background: isApplied ? "#052e16" : "#111827",
                      border: isApplied ? "1px solid #16a34a" : "1px solid #334155",
                      borderRadius: 10,
                      padding: 12,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>
                        {proposal.action || proposal.title || proposal.id}
                      </div>
                      {isBestNext && (
                        <span style={{ fontSize: 10, border: "1px solid #166534", background: "#052e16", color: "#86efac", borderRadius: 999, padding: "3px 7px", fontWeight: 900 }}>
                          Best next
                        </span>
                      )}

                    {isApplied && contribution && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#86efac", fontWeight: 700 }}>
                        Impact: {contribution.delta < 0 ? "" : "+"}{Math.round(contribution.delta * 100)} pts ·
                        {Math.round(contribution.share * 100)}% of total
                      </div>
                    )}

                      {conflictRisk && (
                        <span style={{ fontSize: 10, border: "1px solid #7f1d1d", background: "#450a0a", color: "#fecaca", borderRadius: 999, padding: "3px 7px", fontWeight: 900 }}>
                          Conflict risk
                        </span>
                      )}

                      {!conflictRisk && diminishing && (
                        <span style={{ fontSize: 10, border: "1px solid #78350f", background: "#451a03", color: "#fde68a", borderRadius: 999, padding: "3px 7px", fontWeight: 900 }}>
                          Diminishing returns
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
                      Confidence: {proposal.adjustedConfidence || proposal.confidence || 0}% · Pax-min saved: {proposal.passengerMinutesSaved || proposal.paxMinutesSaved || 0}
                    </div>

                    {mmPlan && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontSize: 11, border: "1px solid #334155", background: "#020617", color: "#cbd5e1", borderRadius: 999, padding: "3px 7px", fontWeight: 800 }}>
                            Uses: {mmPlan.label}
                          </span>
                          <span style={{ fontSize: 11, border: "1px solid #334155", background: "#020617", color: "#cbd5e1", borderRadius: 999, padding: "3px 7px" }}>
                            {mmPlan.availableTotal} available within 600m
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          Selected by nearby availability and proximity, not operator preference.
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleProposal();
                      }}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        padding: "8px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        border: "1px solid #16a34a",
                        background: isApplied ? "#0f3a23" : "#052e16",
                        color: isApplied ? "#bbf7d0" : "#86efac",
                      }}
                    >
                      {isApplied ? "Applied ✓ — click to remove" : "Apply intervention"}
                    </button>
                  </div>
                );
              })}

              {inspectorProposals.length === 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                  No proposals linked to this disruption.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {autopilotLog.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 10030,
            width: 330,
            padding: 12,
            borderRadius: 14,
            background: "rgba(2,6,23,0.96)",
            border: "1px solid rgba(34,211,238,0.35)",
            color: "#e2e8f0",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 11, color: "#67e8f9", fontWeight: 950, letterSpacing: 0.8 }}>
            AUTOPILOT DISPATCHER
          </div>

          <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8" }}>
            Autonomous intervention decisions
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {autopilotLog.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 9,
                  borderRadius: 10,
                  background: "rgba(15,23,42,0.92)",
                  border: "1px solid rgba(51,65,85,0.9)",
                }}
              >
                <div style={{ fontSize: 11, color: "#f8fafc", fontWeight: 900 }}>
                  {item.action}
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: "#94a3b8" }}>
                  {item.disruption}
                </div>
                <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "#67e8f9", fontWeight: 900 }}>
                    Score {item.score}
                  </span>
                  <span style={{ fontSize: 10, color: "#facc15", fontWeight: 900 }}>
                    Priority {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedGtfsStop && (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            zIndex: 10020,
            width: 280,
            padding: 12,
            borderRadius: 12,
            background: "rgba(15,23,42,0.97)",
            color: "#e2e8f0",
            border: "1px solid #334155",
            boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 900, letterSpacing: 0.7 }}>
              GTFS STOP INSPECTOR
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedGtfsStopRef.current = null;
                setSelectedGtfsStop(null);
                requestAnimationFrame(() => renderMapRef.current?.());
              }}
              style={{
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                borderRadius: 7,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: 16, fontWeight: 900, color: "#f8fafc", lineHeight: 1.25 }}>
            {selectedGtfsStop.name || "Unknown stop"}
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            <div><span style={{ color: "#94a3b8" }}>Code:</span> {selectedGtfsStop.code || "—"}</div>
            <div><span style={{ color: "#94a3b8" }}>Stop ID:</span> {selectedGtfsStop.stopId || "—"}</div>
          </div>

          {stopAiConfidence !== null && (
            <div style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background:
                stopAiConfidence >= 80 ? "rgba(239,68,68,0.14)" :
                stopAiConfidence >= 60 ? "rgba(249,115,22,0.14)" :
                stopAiConfidence >= 40 ? "rgba(250,204,21,0.14)" :
                "rgba(34,197,94,0.14)",
              border:
                stopAiConfidence >= 80 ? "1px solid rgba(239,68,68,0.45)" :
                stopAiConfidence >= 60 ? "1px solid rgba(249,115,22,0.45)" :
                stopAiConfidence >= 40 ? "1px solid rgba(250,204,21,0.45)" :
                "1px solid rgba(34,197,94,0.45)",
            }}>
              <div style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 900,
                letterSpacing: 0.6
              }}>
                AI RESPONSE CONFIDENCE
              </div>

              <div style={{
                marginTop: 4,
                display: "flex",
                alignItems: "baseline",
                gap: 6
              }}>
                <span style={{
                  fontSize: 24,
                  fontWeight: 950,
                  color: "#f8fafc"
                }}>
                  {stopAiConfidence}%
                </span>
              </div>

              <div style={{
                marginTop: 3,
                fontSize: 11,
                color: "#cbd5e1"
              }}>
                {stopAiConfidence >= 80 ? "Immediate intervention recommended" :
                 stopAiConfidence >= 60 ? "Adaptive mitigation advised" :
                 stopAiConfidence >= 40 ? "Monitor evolving conditions" :
                 "Network stable"}
              </div>
            </div>
          )}

          {stopResilienceScore !== null && (
            <div style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background:
                stopResilienceScore >= 80 ? "rgba(34,197,94,0.14)" :
                stopResilienceScore >= 60 ? "rgba(132,204,22,0.14)" :
                stopResilienceScore >= 40 ? "rgba(250,204,21,0.14)" :
                stopResilienceScore >= 25 ? "rgba(249,115,22,0.14)" :
                "rgba(239,68,68,0.14)",
              border:
                stopResilienceScore >= 80 ? "1px solid rgba(34,197,94,0.45)" :
                stopResilienceScore >= 60 ? "1px solid rgba(132,204,22,0.45)" :
                stopResilienceScore >= 40 ? "1px solid rgba(250,204,21,0.45)" :
                stopResilienceScore >= 25 ? "1px solid rgba(249,115,22,0.45)" :
                "1px solid rgba(239,68,68,0.45)",
            }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 900, letterSpacing: 0.6 }}>
                NETWORK RESILIENCE
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 950, color: "#f8fafc" }}>
                  {stopResilienceScore}
                </span>
                <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 800 }}>
                  / 100
                </span>
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: "#cbd5e1" }}>
                {stopResilienceScore >= 80 ? "Stable corridor" :
                 stopResilienceScore >= 60 ? "Operationally resilient" :
                 stopResilienceScore >= 40 ? "Degrading under pressure" :
                 stopResilienceScore >= 25 ? "Fragile corridor" :
                 "High collapse risk"}
              </div>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, marginBottom: 5 }}>
              Routes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(selectedGtfsStop.routes || []).slice(0, 14).map((route: string) => (
                <span
                  key={route}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "#020617",
                    border: "1px solid #334155",
                    color: "#cbd5e1",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {route}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#020617", border: "1px solid #1e40af" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 900 }}>
                STOP AI ACTION
              </div>
              <div style={{ fontSize: 11, color: "#bfdbfe", fontWeight: 900 }}>
                {stopAiBestAction ? stopAiBestAction.score : "—"}
              </div>
            </div>

            {stopAiBestAction ? (
              <>
                <div style={{ fontSize: 12, color: "#e0f2fe", fontWeight: 900, lineHeight: 1.3 }}>
                  {stopAiBestAction.proposal.action || stopAiBestAction.proposal.title || stopAiBestAction.proposal.id}
                </div>

                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  {stopAiBestAction.reasons.slice(0, 3).map((reason: string) => (
                    <div key={reason} style={{ color: "#94a3b8", fontSize: 10 }}>
                      • {reason}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    acceptIntervention(String(stopAiBestAction.proposal.id), {
                      disruptionId: stopAiBestAction.proposal.disruptionId,
                      snapshot: {
                        source: "stop_ai_action",
                        stopId: selectedGtfsStop.stopId,
                        stopName: selectedGtfsStop.name,
                        routes: selectedGtfsStop.routes || [],
                        score: stopAiBestAction.score,
                        reasons: stopAiBestAction.reasons,
                      },
                    });
                    setSelectedProposalId(null);
                    setInspectorVersion((v) => v + 1);
                    renderMapRef.current?.();
                  }}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #2563eb",
                    background: "#172554",
                    color: "#bfdbfe",
                    fontSize: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Apply stop AI action
                </button>
              </>
            ) : (
              <div style={{ color: "#64748b", fontSize: 10 }}>
                No direct route match found. Showing nearest disruption fallback when available.
              </div>
            )}
          </div>
        </div>
      )}

      {!!error && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(127,29,29,0.9)",
            color: "#fee2e2",
            fontSize: 12,
            lineHeight: 1.4,
            zIndex: 10,
          }}
        >
          Map error: {error}
        </div>
      )}
    </div>
  );
}
