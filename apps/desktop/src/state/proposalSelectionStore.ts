type Listener = () => void;

let selectedProposalId: string | null = null;
let listeners: Listener[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function getSelectedProposalId() {
  return selectedProposalId;
}

export function setSelectedProposalId(id: string | null) {
  selectedProposalId = id;
  emit();
}

export function subscribeProposalSelection(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
