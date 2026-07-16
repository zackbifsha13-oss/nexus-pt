import { getAccepted } from "../state/interventionStore";
import { getCityScenario } from "../data/cityData";
import { getLiveTrafficSnapshot } from "../state/liveTrafficStore";
import { getDisruptionOverride } from "../state/disruptionActionStore";

export type EffectiveDisruption = {
  id: string;
  title?: string;
  description?: string;
  line?: string;
  location?: string;
  startMinute: number;
  endMinute: number;
  effectiveStartMinute: number;
  effectiveEndMinute: number;
  baseSeverity: number;
  effectiveSeverity: number;
  resolved: boolean;
  effectiveIntensity?: number;
  affectedPax?: number;
  effectiveAffectedPax?: number;
  status?: string;
  interventionIds: string[];
  fromStop?: { id?: string; name?: string; coordinates?: [number, number] };
  toStop?: { id?: string; name?: string; coordinates?: [number, number] };
  source: any;
};

export type NetworkLoadState = {
  lineId: string;
  name?: string;
  mode?: string;
  status?: string;
  baseLoad: number;
  disruptionImpact: number;
  interventionImpact: number;
  trafficImpact: number;
  effectiveLoad: number;
  degraded: boolean;
  source: any;
};

export type SimulationState = {
  disruptions: EffectiveDisruption[];
  network: NetworkLoadState[];
  totals: {
    activeDisruptions: number;
    paxAffected: number;
    paxMinSaved: number;
    acceptedInterventions: number;
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function severityToNumber(severity: string | undefined): number {
  switch (severity) {
    case "critical":
      return 1;
    case "high":
      return 0.75;
    case "medium":
      return 0.5;
    case "low":
      return 0.25;
    default:
      return 0.5;
  }
}

function normalizeLineId(line: string | undefined): string | null {
  if (!line) return null;

  if (line.includes("M1")) return "M1";
  if (line.includes("M2")) return "M2";
  if (line.includes("M3")) return "M3";
  if (line.includes("T4")) return "T4";
  if (line.includes("T5")) return "T5";
  if (line.includes("040")) return "B040";
  if (line.includes("224")) return "B224";
  if (line.includes("608")) return "B608";
  if (line.includes("X95")) return "BX95";
  if (line.includes("METRO")) return "METRO";
  if (line.toLowerCase().includes("beat")) return "TX_BEAT";
  if (line.toLowerCase().includes("lime")) return "MM_LIME";
  if (line.toLowerCase().includes("bolt")) return "MM_BOLT";
  if (line.toLowerCase().includes("hop")) return "MM_HOP";

  return null;
}

function sqDist(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function snapDisruptionToStops(city: any, disruption: any) {
  const lineId = normalizeLineId(disruption.line);
  const stops = lineId ? city.MAP?.transitStops?.[lineId] : null;
  const loc = city.MAP?.locations?.[disruption.location];

  if (!Array.isArray(stops) || stops.length < 2 || !Array.isArray(loc)) {
    return { fromStop: undefined, toStop: undefined };
  }

  const enriched = stops
    .filter((s: any) => Array.isArray(s.coordinates) && s.coordinates.length >= 2)
    .map((s: any, idx: number) => ({
      ...s,
      idx,
      dist: sqDist(loc as [number, number], s.coordinates as [number, number]),
    }))
    .sort((a: any, b: any) => a.dist - b.dist);

  if (enriched.length === 0) {
    return { fromStop: undefined, toStop: undefined };
  }

  const first = enriched[0];
  const second =
    enriched.find((s: any) => Math.abs(s.idx - first.idx) <= 2 && s.idx !== first.idx) ||
    enriched[1] ||
    first;

  const ordered = [first, second].sort((a: any, b: any) => a.idx - b.idx);

  return {
    fromStop: {
      id: ordered[0]?.id,
      name: ordered[0]?.name,
      coordinates: ordered[0]?.coordinates,
    },
    toStop: {
      id: ordered[1]?.id,
      name: ordered[1]?.name,
      coordinates: ordered[1]?.coordinates,
    },
  };
}

export function getSimulationState(cityKey: string, currentMinute: number): SimulationState {
  const city = getCityScenario(cityKey);
  const acceptedIds = getAccepted();
  const acceptedSet = new Set(acceptedIds);
  const traffic = getLiveTrafficSnapshot(cityKey);

  const allInterventions = city.INTERVENTIONS ?? [];
  const allDisruptions = city.DISRUPTIONS ?? [];
  const networkLines = city.NETWORK_LINES ?? [];

  const disruptions: EffectiveDisruption[] = allDisruptions.map((disruption: any) => {
    const linkedAccepted = allInterventions.filter(
      (i: any) => i.disruptionId === disruption.id && acceptedSet.has(i.id)
    );

    const actionOverride = getDisruptionOverride(disruption.id);
    const baseSeverity = severityToNumber(disruption.severity);
    const directTraffic = traffic.byDisruption?.[disruption.id] ?? 0;
    const lineTraffic = traffic.byLine?.[normalizeLineId(disruption.line) || ""] ?? 0;
    const trafficBoost = Math.max(directTraffic, lineTraffic * 0.7);

    let effectiveSeverity = baseSeverity + trafficBoost * 0.22;
    let effectiveIntensity = baseSeverity + trafficBoost * 0.35;
    let effectiveEndMinute = disruption.endMinute + Math.round(trafficBoost * 6);
    let affectedPaxDelta = Math.round((disruption.affectedPax ?? 0) * trafficBoost * 0.08);
    let statusOverride = actionOverride?.status || disruption.status;
    let resolved = actionOverride?.resolved || disruption.status === "resolved";

    if (typeof actionOverride?.severityDelta === "number") {
      effectiveSeverity += actionOverride.severityDelta;
      effectiveIntensity += actionOverride.severityDelta * 0.8;
    }

    for (const intervention of linkedAccepted) {
      const fx = intervention.effects ?? {};

      if (typeof fx.severityDelta === "number") {
        effectiveSeverity += fx.severityDelta;
      }

      if (typeof fx.intensityDelta === "number") {
        effectiveIntensity += fx.intensityDelta;
      }

      if (typeof fx.durationDeltaMin === "number") {
        effectiveEndMinute += fx.durationDeltaMin;
      }

      if (typeof fx.affectedPaxDelta === "number") {
        affectedPaxDelta += fx.affectedPaxDelta;
      }

      if (typeof fx.statusOverride === "string") {
        statusOverride = fx.statusOverride;
      }

      if (fx.resolveAtAcceptance) {
        resolved = true;
        statusOverride = "resolved";
      }
    }

    effectiveSeverity = clamp(effectiveSeverity, 0, 1);
    effectiveIntensity = clamp(effectiveIntensity, 0, 1);
    effectiveEndMinute = Math.max(disruption.startMinute ?? 0, effectiveEndMinute ?? currentMinute);

    if (typeof effectiveEndMinute === "number" && currentMinute >= effectiveEndMinute) {
      resolved = true;
      statusOverride = "resolved";
    }

    const baseAffectedPax = disruption.affectedPax ?? 0;
    const effectiveAffectedPax = Math.max(
      0,
      Math.round(baseAffectedPax * effectiveSeverity + affectedPaxDelta)
    );

    const snapped = snapDisruptionToStops(city, disruption);

    return {
      id: disruption.id,
      title: disruption.title,
      description: disruption.description,
      line: disruption.line,
      location: disruption.location,
      startMinute: disruption.startMinute ?? 0,
      endMinute: disruption.endMinute ?? 0,
      effectiveStartMinute: disruption.startMinute ?? 0,
      effectiveEndMinute,
      baseSeverity,
      effectiveSeverity,
      resolved,
      effectiveIntensity,
      affectedPax: baseAffectedPax,
      effectiveAffectedPax,
      status: statusOverride,
      interventionIds: linkedAccepted.map((i: any) => i.id),
      fromStop: snapped.fromStop,
      toStop: snapped.toStop,
      source: disruption,
    };
  });

  const visibleDisruptions = disruptions.filter(
    (d) =>
      !d.resolved &&
      currentMinute >= d.startMinute &&
      currentMinute < d.effectiveEndMinute
  );

  const network: NetworkLoadState[] = networkLines.map((line: any) => {
    const baseLoad = typeof line.load === "number" ? line.load / 100 : 0.4;

    const disruptionImpact = visibleDisruptions
      .filter((d) => normalizeLineId(d.line) === line.id)
      .reduce((sum, d) => sum + d.effectiveSeverity * 0.35 + (d.effectiveIntensity ?? d.effectiveSeverity) * 0.08, 0);

    const interventionImpact = allInterventions
      .filter((i: any) => acceptedSet.has(i.id))
      .reduce((sum: number, i: any) => {
        const delta = i.effects?.loadRedistribution?.[line.id];
        return typeof delta === "number" ? sum + delta : sum;
      }, 0);

    const trafficImpact = (traffic.byLine?.[line.id] ?? 0) * 0.35;

    const effectiveLoad = clamp(baseLoad + disruptionImpact + interventionImpact + trafficImpact, 0, 1.5);

    return {
      lineId: line.id,
      name: line.name,
      mode: line.mode,
      status: line.status,
      baseLoad,
      disruptionImpact,
      interventionImpact,
      trafficImpact,
      effectiveLoad,
      degraded: effectiveLoad >= 0.85,
      source: line,
    };
  });

  const paxAffected = visibleDisruptions.reduce(
    (sum, d) => sum + (d.effectiveAffectedPax ?? 0),
    0
  );

  const paxMinSaved = allInterventions
    .filter((i: any) => acceptedSet.has(i.id))
    .reduce((sum: number, i: any) => sum + (i.passengerMinutesSaved ?? 0), 0);

  return {
    disruptions: visibleDisruptions,
    network,
    totals: {
      activeDisruptions: visibleDisruptions.length,
      paxAffected,
      paxMinSaved,
      acceptedInterventions: acceptedIds.length,
    },
  };
}
