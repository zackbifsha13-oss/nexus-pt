import {
  getUnevaluatedAcceptedDecisions,
  updateDecisionOutcome,
} from "./decisionLogStore";
import { getTimelineState } from "./timelineStore";
import { getCityData } from "../data/cityData";

function severityNumber(severity?: string) {
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

function scoreDecision(entry: any, activeAfterDecision: boolean, actualSeverity: number) {
  const expectedResolve = !!entry.snapshot?.expectedResolve;
  const expectedSeverityDelta =
    typeof entry.snapshot?.expectedSeverityDelta === "number"
      ? entry.snapshot.expectedSeverityDelta
      : 0;

  if (expectedResolve) {
    return activeAfterDecision ? 35 : 95;
  }

  if (expectedSeverityDelta < 0) {
    const baseSeverity = severityNumber(entry.snapshot?.severity);
    const expectedSeverity = Math.max(0, baseSeverity + expectedSeverityDelta);
    const diff = Math.abs(expectedSeverity - actualSeverity);
    return Math.max(20, Math.round(100 - diff * 100));
  }

  return activeAfterDecision ? 65 : 85;
}

export function evaluatePendingOutcomes() {
  const { currentMinute } = getTimelineState();
  const city = getCityData();
  const pending = getUnevaluatedAcceptedDecisions();

  for (const entry of pending) {
    const decisionAgeMin = Math.max(
      0,
      Math.floor((Date.now() - new Date(entry.timestamp).getTime()) / 60000)
    );

    const expectedDuration = Math.abs(entry.snapshot?.expectedDurationDeltaMin || 0);
    const evaluationDelay = Math.max(3, Math.min(12, expectedDuration || 5));

    if (decisionAgeMin < evaluationDelay && currentMinute < 9 * 60 + evaluationDelay) {
      continue;
    }

    const disruption = city.DISRUPTIONS.find((d: any) => d.id === entry.disruptionId);
    const activeAfterDecision = !!disruption;
    const actualSeverity = disruption ? severityNumber(disruption.severity) : 0;
    const accuracyScore = scoreDecision(entry, activeAfterDecision, actualSeverity);

    const summary = activeAfterDecision
      ? `Still active; observed severity ${disruption?.severity || "unknown"}.`
      : "Disruption no longer active in current network state.";

    updateDecisionOutcome(entry.id, {
      evaluatedAt: new Date().toISOString(),
      timelineMinute: currentMinute,
      activeAfterDecision,
      actualSeverity,
      accuracyScore,
      summary,
    });
  }
}
