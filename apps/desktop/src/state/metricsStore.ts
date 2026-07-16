export interface AcceptedDecision {
  interventionId: string;
  disruptionId: string;
  passengerMinutesSaved: number;
}

let acceptedDecisions: AcceptedDecision[] = [];
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getAcceptedDecisions(): AcceptedDecision[] {
  return [...acceptedDecisions];
}

export function acceptDecision(decision: AcceptedDecision) {
  const exists = acceptedDecisions.some(
    (d) => d.interventionId === decision.interventionId
  );
  if (!exists) {
    acceptedDecisions = [...acceptedDecisions, decision];
    notify();
  }
}

export function removeAcceptedDecision(interventionId: string) {
  acceptedDecisions = acceptedDecisions.filter(
    (d) => d.interventionId !== interventionId
  );
  notify();
}

export function getLivePassengerMinutesSaved(): number {
  return acceptedDecisions.reduce((sum, d) => sum + d.passengerMinutesSaved, 0);
}

export function getAcceptedDecisionCount(): number {
  return acceptedDecisions.length;
}
