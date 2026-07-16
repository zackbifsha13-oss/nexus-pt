type DecisionStatus = "accepted" | "rejected";

let decisions: Record<string, DecisionStatus> = {};
let listeners: (() => void)[] = [];

export function getDecision(id: string): DecisionStatus | undefined {
  return decisions[id];
}

export function setDecision(id: string, status: DecisionStatus) {
  decisions[id] = status;
  listeners.forEach((l) => l());
}

export function clearDecision(id: string) {
  delete decisions[id];
  listeners.forEach((l) => l());
}

export function subscribeDecisions(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
