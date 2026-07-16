import { useEffect, useState } from "react";
import { getDecisionLog, subscribeDecisionLog } from "../state/decisionLogStore";

function actionColor(action: string) {
  switch (action) {
    case "accepted":
      return "#10b981";
    case "modified":
      return "#3b82f6";
    case "rejected":
      return "#f59e0b";
    default:
      return "#94a3b8";
  }
}

export default function AuditLogPage() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = subscribeDecisionLog(() => forceUpdate((x) => x + 1));
    return () => unsub();
  }, []);

  const entries = getDecisionLog();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Operator Decision Log</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Accept / modify / reject events for evaluation, explainability testing, and adaptive proposal ranking.
          </p>
        </div>

        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {entries.length} logged decisions
        </div>
      </div>

      <div
        style={{
          background: "#161b26",
          border: "1px solid #2a3347",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {entries.length === 0 ? (
          <div style={{ padding: 24, color: "#94a3b8", fontSize: 14 }}>
            No operator decisions logged yet.
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              style={{
                padding: 16,
                borderTop: index === 0 ? "none" : "1px solid #2a3347",
                display: "grid",
                gridTemplateColumns: "140px 120px 1fr 180px",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Time</div>
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Action</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "capitalize",
                    color: actionColor(entry.action),
                  }}
                >
                  {entry.action}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {entry.disruptionId} · {entry.proposalId}
                </div>
                <div style={{ fontSize: 14, color: "#e2e8f0", marginTop: 4 }}>
                  {entry.snapshot?.line || "Unknown line"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {entry.snapshot?.location || "Unknown location"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Impact Snapshot</div>
                <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>
                  Pax·min: {(entry.snapshot?.passengerMinutesSaved || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "#e2e8f0" }}>
                  Confidence: {entry.snapshot?.confidence ?? 0}%
                </div>
                {entry.outcome ? (
                  <>
                    <div style={{ fontSize: 12, color: "#22c55e", marginTop: 6 }}>
                      Accuracy: {entry.outcome.accuracyScore}%
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {entry.outcome.summary}
                    </div>
                  </>
                ) : entry.action === "accepted" ? (
                  <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 6 }}>
                    Pending outcome evaluation
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
