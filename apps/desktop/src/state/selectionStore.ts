let selectedId: string | null = null;
let listeners: Array<() => void> = [];

export function getSelectedId() {
  return selectedId;
}

export function setSelectedId(id: string | null) {
  selectedId = id;
  listeners.forEach((listener) => listener());
}

export function subscribeSelection(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
