type DecisionAction = "accepted" | "rejected" | "modified";

export type DecisionLogEntry = {
  id: string;
  timestamp: string;
  disruptionId: string;
  proposalId: string;
  action: DecisionAction;
  operatorId?: string;
  note?: string;
  snapshot?: {
    cityId?: string;
    line?: string;
    location?: string;
    severity?: string;
    affectedPax?: number;
    passengerMinutesSaved?: number;
    confidence?: number;
    expectedSeverityDelta?: number;
    expectedDurationDeltaMin?: number;
    expectedResolve?: boolean;
  };
  outcome?: {
    evaluatedAt: string;
    timelineMinute: number;
    activeAfterDecision: boolean;
    actualSeverity?: number;
    accuracyScore: number;
    summary: string;
  };
};

type Listener = () => void;

const STORAGE_KEY = "nexus-pt-decision-log";

const g = globalThis as any;
g.__NEXUS_DECISION_LOG__ ||= {
  entries: [] as DecisionLogEntry[],
  listeners: [] as Listener[],
  loaded: false,
};

function load() {
  if (g.__NEXUS_DECISION_LOG__.loaded) return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    g.__NEXUS_DECISION_LOG__.entries = raw ? JSON.parse(raw) : [];
  } catch {
    g.__NEXUS_DECISION_LOG__.entries = [];
  }

  g.__NEXUS_DECISION_LOG__.loaded = true;
}

function save() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(g.__NEXUS_DECISION_LOG__.entries)
    );
  } catch {
    // ignore
  }
}

function emit() {
  g.__NEXUS_DECISION_LOG__.listeners.forEach((l: Listener) => l());
}

export function logDecision(entry: Omit<DecisionLogEntry, "id" | "timestamp">) {
  load();

  const next: DecisionLogEntry = {
    ...entry,
    id: `LOG-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
  };

  g.__NEXUS_DECISION_LOG__.entries = [next, ...g.__NEXUS_DECISION_LOG__.entries];
  save();
  emit();

  console.log("NEXUS decision logged", next);

  return next;
}

export function getDecisionLog() {
  load();
  return g.__NEXUS_DECISION_LOG__.entries as DecisionLogEntry[];
}

export function subscribeDecisionLog(listener: Listener) {
  load();
  g.__NEXUS_DECISION_LOG__.listeners.push(listener);
  return () => {
    g.__NEXUS_DECISION_LOG__.listeners =
      g.__NEXUS_DECISION_LOG__.listeners.filter((l: Listener) => l !== listener);
  };
}

export function clearDecisionLog() {
  g.__NEXUS_DECISION_LOG__.entries = [];
  save();
  emit();
}


export function updateDecisionOutcome(
  entryId: string,
  outcome: DecisionLogEntry["outcome"]
) {
  load();

  g.__NEXUS_DECISION_LOG__.entries = g.__NEXUS_DECISION_LOG__.entries.map(
    (entry: DecisionLogEntry) =>
      entry.id === entryId
        ? {
            ...entry,
            outcome,
          }
        : entry
  );

  save();
  emit();
}

export function getUnevaluatedAcceptedDecisions() {
  load();

  return (g.__NEXUS_DECISION_LOG__.entries as DecisionLogEntry[]).filter(
    (entry) => entry.action === "accepted" && !entry.outcome
  );
}
