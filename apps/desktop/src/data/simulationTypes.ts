export interface InterventionEffect {
  severityDelta?: number;
  durationDeltaMin?: number;
  resolveAtAcceptance?: boolean;
  intensityDelta?: number;
  radiusDelta?: number;
  affectedPaxDelta?: number;
  statusOverride?: "active" | "stabilizing" | "resolved";
  loadRedistribution?: Record<string, number>;
}

export interface DisruptionPathMap {
  [disruptionId: string]: [number, number][];
}
