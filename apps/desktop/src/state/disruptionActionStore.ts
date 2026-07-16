type DisruptionOverride = {
  status?: "active" | "stabilizing" | "resolved";
  severityDelta?: number;
  resolved?: boolean;
};

type Listener = () => void;

const overrides = new Map<string, DisruptionOverride>();
const listeners: Listener[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function getDisruptionOverride(id: string) {
  return overrides.get(id);
}

export function getAllDisruptionOverrides() {
  return Object.fromEntries(overrides.entries());
}

export function markDisruptionStabilizing(id: string) {
  const current = overrides.get(id) || {};
  overrides.set(id, {
    ...current,
    status: "stabilizing",
  });
  emit();
}

export function escalateDisruption(id: string) {
  const current = overrides.get(id) || {};
  overrides.set(id, {
    ...current,
    status: "active",
    severityDelta: (current.severityDelta || 0) + 0.15,
  });
  emit();
}

export function closeDisruption(id: string) {
  const current = overrides.get(id) || {};
  overrides.set(id, {
    ...current,
    status: "resolved",
    resolved: true,
  });
  emit();
}

export function clearDisruptionOverride(id: string) {
  overrides.delete(id);
  emit();
}

export function subscribeDisruptionActions(listener: Listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
