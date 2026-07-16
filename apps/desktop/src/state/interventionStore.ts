import { logDecision } from "./decisionLogStore";

const STORAGE_KEY = "nexus-pt-accepted-interventions";

const g = globalThis as any;
g.__NEXUS_INTERVENTIONS__ ||= {
  accepted: new Set<string>(),
  listeners: [] as Array<() => void>,
  loaded: false,
};

function load() {
  if (g.__NEXUS_INTERVENTIONS__.loaded) return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    g.__NEXUS_INTERVENTIONS__.accepted = new Set(
      Array.isArray(ids) ? ids.map(String) : []
    );
  } catch {
    g.__NEXUS_INTERVENTIONS__.accepted = new Set<string>();
  }

  g.__NEXUS_INTERVENTIONS__.loaded = true;
}

function save() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(g.__NEXUS_INTERVENTIONS__.accepted))
    );
  } catch {
    // ignore
  }
}

function emit() {
  g.__NEXUS_INTERVENTIONS__.listeners.forEach((l: () => void) => l());
}

export function acceptIntervention(id: string, context?: any) {
  load();

  const proposalId = String(id);
  g.__NEXUS_INTERVENTIONS__.accepted.add(proposalId);
  save();

  console.log("NEXUS accept", proposalId, Array.from(g.__NEXUS_INTERVENTIONS__.accepted));

  logDecision({
    disruptionId: context?.disruptionId || "unknown",
    proposalId,
    action: "accepted",
    operatorId: context?.operatorId,
    snapshot: context?.snapshot,
  });

  emit();
}

export function rejectIntervention(id: string, context?: any) {
  load();

  const proposalId = String(id);
  g.__NEXUS_INTERVENTIONS__.accepted.delete(proposalId);
  save();

  console.log("NEXUS reject", proposalId, Array.from(g.__NEXUS_INTERVENTIONS__.accepted));

  logDecision({
    disruptionId: context?.disruptionId || "unknown",
    proposalId,
    action: "rejected",
    operatorId: context?.operatorId,
    snapshot: context?.snapshot,
  });

  emit();
}

export function isAccepted(id: string) {
  load();
  return g.__NEXUS_INTERVENTIONS__.accepted.has(String(id));
}

export function getAccepted() {
  load();
  return Array.from(g.__NEXUS_INTERVENTIONS__.accepted) as string[];
}

export function subscribeInterventions(cb: () => void) {
  load();
  g.__NEXUS_INTERVENTIONS__.listeners.push(cb);
  return () => {
    g.__NEXUS_INTERVENTIONS__.listeners =
      g.__NEXUS_INTERVENTIONS__.listeners.filter((l: () => void) => l !== cb);
  };
}

export function clearAcceptedInterventions() {
  load();
  g.__NEXUS_INTERVENTIONS__.accepted = new Set<string>();
  save();
  emit();
}


export function modifyIntervention(id: string, context?: any) {
  load();

  const proposalId = String(id);

  console.log("NEXUS modify", proposalId);

  logDecision({
    disruptionId: context?.disruptionId || "unknown",
    proposalId,
    action: "modified",
    operatorId: context?.operatorId,
    note: context?.note,
    snapshot: context?.snapshot,
  });

  emit();
}
