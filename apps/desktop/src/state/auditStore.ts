export type AuditDecision = "accepted" | "rejected";

export interface AuditEntry {
  id: string;
  timestamp: string;
  operator: string;
  terminal: string;
  disruptionId: string;
  interventionId: string;
  interventionAction: string;
  decision: AuditDecision;
}

let auditLog: AuditEntry[] = [];

function nowTime() {
  return new Date().toLocaleString("el-GR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

export function addAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const newEntry: AuditEntry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: nowTime(),
    ...entry,
  };
  auditLog = [newEntry, ...auditLog];
  return newEntry;
}

export function clearAuditLog() {
  auditLog = [];
}
