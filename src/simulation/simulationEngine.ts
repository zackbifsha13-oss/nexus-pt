import { getAccepted } from "../stores/interventionStore";
import { getCityScenario } from "../data/cityData";

export type EffectiveDisruption = {
  id: string;
  title?: string;
  description?: string;
  lineId?: string;
  locationId?: string;
  startMinute: number;
  endMinute: number;
  effectiveStartMinute: number;
  effectiveEndMinute: number;
  baseSeverity: number;
  effectiveSeverity: number;
  resolved: boolean;
  affectedRadius?: number;
  effectiveRadius?: number;
  intensity?: number;
  effectiveIntensity?: number;
  paxAffected?: number;
  effectivePaxAffected?: number;
  interventionIds: string[];
};

export type NetworkLoadState = {
  lineId: string;
  baseLoad: number;
  disruptionImpact: number;
  interventionImpact: number;
  effectiveLoad: number;
  degraded: boolean;
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

export function getSimulationState(cityKey: string, currentMinute: number): SimulationState {
  const city = getCityScenario(cityKey);
  const acceptedIds = getAccepted();
  const acceptedSet = new Set(acceptedIds);

  const allInterventions = city.INTERVENTIONS ?? [];
  const allDisruptions = city.DISRUPTIONS ?? [];
  const networkLines = city.NETWORK_LINES ?? [];

  const disruptions: EffectiveDisruption[] = allDisruptions.map((disruption: any) => {
    const linkedAccepted = allInterventions.filter(
      (i: any) => i.disruptionId === disruption.id && acceptedSet.has(i.id)
    );

    let effectiveSeverity = disruption.severity ?? 1;
    let effectiveEndMinute = disruption.endMinute;
    let effectiveRadius = disruption.affectedRadius ?? disruption.radius ?? 300;
    let effectiveIntensity = disruption.intensity ?? disruption.severity ?? 1;
    let resolved = false;

    for (const intervention of linkedAccepted) {
      const fx = intervention.effects ?? {};

      if (typeof fx.severityDelta === "number") {
        effectiveSeverity += fx.severityDelta;
      }

      if (typeof fx.durationDeltaMin === "number") {
        effectiveEndMinute += fx.durationDeltaMin;
      }

      if (typeof fx.radiusDelta === "number") {
        effectiveRadius += fx.radiusDelta;
      }

      if (typeof fx.intensityDelta === "number") {
        effectiveIntensity += fx.intensityDelta;
      }

      if (fx.resolveAtAcceptance) {
        resolved = true;
      }
    }

    effectiveSeverity = clamp(effectiveSeverity, 0, 1);
    effectiveRadius = Math.max(0, effectiveRadius);
    effectiveIntensity = clamp(effectiveIntensity, 0, 1);
    effectiveEndMinute = Math.max(disruption.startMinute, effectiveEndMinute);

    if (currentMinute >= effectiveEndMinute) {
      resolved = true;
    }

    const basePax = disruption.paxAffected ?? 0;
    const effectivePaxAffected = Math.round(basePax * effectiveSeverity);

    return {
      ...disruption,
      effectiveStartMinute: disruption.startMinute,
      effectiveEndMinute,
      baseSeverity: disruption.severity ?? 1,
      effectiveSeverity,
      resolved,
      affectedRadius: disruption.affectedRadius ?? disruption.radius,
      effectiveRadius,
      intensity: disruption.intensity ?? disruption.severity ?? 1,
      effectiveIntensity,
      paxAffected: basePax,
      effectivePaxAffected,
      interventionIds: linkedAccepted.map((i: any) => i.id),
    };
  });

  const visibleDisruptions = disruptions.filter(
    (d) =>
      !d.resolved &&
      currentMinute >= d.startMinute &&
      currentMinute < d.effectiveEndMinute
  );

  const network: NetworkLoadState[] = networkLines.map((line: any) => {
    const baseLoad = line.baseLoad ?? 0.4;

    const disruptionImpact = visibleDisruptions
      .filter((d) => d.lineId === line.id)
      .reduce((sum, d) => sum + d.effectiveSeverity * 0.35, 0);

    const interventionImpact = allInterventions
      .filter((i: any) => acceptedSet.has(i.id))
      .reduce((sum: number, i: any) => {
        const delta = i.effects?.loadRedistribution?.[line.id];
        return typeof delta === "number" ? sum + delta : sum;
      }, 0);

    const effectiveLoad = clamp(baseLoad + disruptionImpact + interventionImpact, 0, 1.5);

    return {
      lineId: line.id,
      baseLoad,
      disruptionImpact,
      interventionImpact,
      effectiveLoad,
      degraded: effectiveLoad >= 0.85,
    };
  });

  const paxAffected = visibleDisruptions.reduce(
    (sum, d) => sum + (d.effectivePaxAffected ?? 0),
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
