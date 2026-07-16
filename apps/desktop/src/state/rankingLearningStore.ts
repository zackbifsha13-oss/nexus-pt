import { getDecisionLog } from "./decisionLogStore";

export function getProposalAccuracyMap() {
  const log = getDecisionLog();
  const map: Record<string, { total: number; count: number }> = {};

  for (const entry of log) {
    if (entry.action !== "accepted" || !entry.outcome) continue;

    const id = String(entry.proposalId);

    if (!map[id]) {
      map[id] = { total: 0, count: 0 };
    }

    map[id].total += entry.outcome.accuracyScore || 0;
    map[id].count += 1;
  }

  const result: Record<string, number> = {};
  for (const id in map) {
    result[id] = map[id].total / map[id].count;
  }

  return result;
}

export function sortInterventionsByLearning(interventions: any[]) {
  const accuracy = getProposalAccuracyMap();

  return [...interventions].sort((a, b) => {
    const accA = accuracy[a.id] ?? a.confidence ?? 50;
    const accB = accuracy[b.id] ?? b.confidence ?? 50;

    // combine confidence + learned accuracy
    const scoreA = accA * 0.6 + (a.confidence || 50) * 0.4;
    const scoreB = accB * 0.6 + (b.confidence || 50) * 0.4;

    return scoreB - scoreA;
  });
}
