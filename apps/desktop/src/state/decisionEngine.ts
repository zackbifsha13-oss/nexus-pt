export type RankedIntervention = {
  proposal: any;
  score: number;
  reasons: string[];
  positives: string[];
  penalties: string[];
  metrics: {
    confidence: number;
    paxSaved: number;
    severityReductionPts: number;
    recoveryMinutesSaved: number;
  };
};

function n(value: any, fallback = 0) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

export function rankInterventionsForDisruption({
  proposals,
  appliedIds,
}: {
  proposals: any[];
  appliedIds: string[];
}): RankedIntervention[] {
  const applied = new Set(appliedIds.map(String));

  return proposals
    .filter((p) => !applied.has(String(p.id)))
    .map((proposal) => {
      const confidence = n(proposal.adjustedConfidence ?? proposal.confidence, 50);
      const paxSaved = n(proposal.passengerMinutesSaved ?? proposal.paxMinutesSaved, 0);
      const severityDelta = n(proposal.effects?.severityDelta, 0);
      const durationDelta = n(proposal.effects?.durationDeltaMin, 0);
      const resourceCount = Array.isArray(proposal.resources) ? proposal.resources.length : 0;

      const severityReductionPts = severityDelta < 0 ? Math.round(Math.abs(severityDelta) * 100) : 0;
      const recoveryMinutesSaved = durationDelta < 0 ? Math.abs(durationDelta) : 0;

      const impactScore =
        severityReductionPts * 1.2 +
        recoveryMinutesSaved * 2 +
        Math.min(60, paxSaved / 300);

      const confidenceScore = confidence;
      const resourcePenalty = Math.max(0, resourceCount - 2) * 4;

      const score =
        impactScore * 0.55 +
        confidenceScore * 0.35 +
        Math.min(40, paxSaved / 500) * 0.1 -
        resourcePenalty;

      const positives: string[] = [];
      const penalties: string[] = [];

      if (paxSaved > 0) positives.push(`Saves ${paxSaved.toLocaleString()} passenger-minutes`);
      if (severityReductionPts > 0) positives.push(`Reduces severity by ${severityReductionPts} pts`);
      if (recoveryMinutesSaved > 0) positives.push(`Speeds recovery by ${recoveryMinutesSaved} min`);
      if (confidence >= 75) positives.push("High-confidence intervention");
      else if (confidence >= 55) positives.push("Medium-confidence intervention");

      if (resourcePenalty > 0) penalties.push(`Resource-heavy: ${resourceCount} required items`);
      if (confidence < 55) penalties.push("Lower confidence than alternatives");
      if (paxSaved <= 0) penalties.push("Passenger-minute impact not quantified");

      const reasons = [...positives, ...penalties.map((p) => `Penalty: ${p}`)];

      return {
        proposal,
        score: Math.max(0, Math.round(score)),
        reasons,
        positives,
        penalties,
        metrics: {
          confidence,
          paxSaved,
          severityReductionPts,
          recoveryMinutesSaved,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}


export function planInterventionSequence({
  proposals,
  appliedIds,
  maxSteps = 3,
}: {
  proposals: any[];
  appliedIds: string[];
  maxSteps?: number;
}) {
  const plan: any[] = [];
  let currentApplied = [...appliedIds];

  for (let i = 0; i < maxSteps; i++) {
    const ranked = rankInterventionsForDisruption({
      proposals,
      appliedIds: currentApplied,
    });

    if (!ranked.length) break;

    const best = ranked[0];

    // Avoid duplicates
    if (currentApplied.includes(String(best.proposal.id))) break;

    plan.push(best);
    currentApplied.push(String(best.proposal.id));
  }

  return plan;
}
