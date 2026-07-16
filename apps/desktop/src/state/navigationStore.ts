export type Page =
  | "dashboard"
  | "network"
  | "disruptions"
  | "interventions"
  | "audit-log"
  | "settings";

let currentPage: Page = "dashboard";
let selectedDisruptionId: string | null = null;

let listeners: Array<() => void> = [];

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeNavigation(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function navigate(page: Page, disruptionId?: string) {
  currentPage = page;
  if (typeof disruptionId === "string") {
    selectedDisruptionId = disruptionId;
  }
  notify();
}

export function getNavigation() {
  return {
    page: currentPage,
    disruptionId: selectedDisruptionId,
  };
}
