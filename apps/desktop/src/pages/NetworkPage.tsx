import { useEffect, useState } from "react";
import { getCityData } from "../data/cityData";
import NetworkMapView from "../components/NetworkMapView";
import { getSimulationState } from "../simulation/simulationEngine";
import { subscribeTimeline, getTimelineState } from "../state/timelineStore";
import { subscribeInterventions } from "../state/interventionStore";
import { setSelectedId } from "../state/selectionStore";

function statusColor(status: string) {
  switch (status) {
    case "crit":
      return "#ef4444";
    case "warn":
      return "#f59e0b";
    case "info":
      return "#3b82f6";
    default:
      return "#10b981";
  }
}

function loadBarColor(load: number) {
  if (load > 0.95) return "#ef4444";
  if (load > 0.75) return "#f59e0b";
  if (load > 0.5) return "#3b82f6";
  return "#10b981";
}

function loadStatus(load: number) {
  if (load > 0.95) return "crit";
  if (load > 0.75) return "warn";
  if (load > 0.5) return "info";
  return "ok";
}

function normalizeLineId(value: any) {
  const text = String(value || "").toUpperCase();
  if (text.startsWith("M1") || text.includes("LINE 1")) return "M1";
  if (text.startsWith("M2") || text.includes("LINE 2")) return "M2";
  if (text.startsWith("M3") || text.includes("LINE 3")) return "M3";
  if (text.startsWith("T2")) return "T2";
  if (text.startsWith("T3")) return "T3";
  if (text.startsWith("T4")) return "T4";
  if (text.startsWith("X95")) return "X95";
  if (text.startsWith("040")) return "040";
  return text.split(/[ —-]/)[0] || text;
}

function disruptionMatchesLine(disruption: any, line: any) {
  const lineId = normalizeLineId(line.id);
  const disruptionLine = normalizeLineId(disruption.line || disruption.source?.line);
  return disruptionLine === lineId || String(disruption.line || "").toUpperCase().includes(lineId);
}

function summarizeDisruption(disruption: any) {
  return (
    disruption.description ||
    disruption.summary ||
    disruption.title ||
    "Operational disruption detected on this corridor. Review severity, location, and linked interventions on the map."
  );
}

export default function NetworkPage() {
  const [, forceUpdate] = useState(0);
  const [expandedDisruptionId, setExpandedDisruptionId] = useState<string | null>(null);

  useEffect(() => {
    const rerender = () => forceUpdate((x) => x + 1);
    const unsubTimeline = subscribeTimeline(rerender);
    const unsubInterventions = subscribeInterventions(rerender);

    return () => {
      unsubTimeline();
      unsubInterventions();
    };
  }, []);

  const city = getCityData();
  const { NETWORK_LINES, CITY_CONFIG } = city;
  const sim = getSimulationState(CITY_CONFIG.id, getTimelineState().currentMinute);

  const simById = Object.fromEntries(sim.network.map((line: any) => [line.lineId, line]));

  const effectiveLines = NETWORK_LINES.map((line: any) => {
    const simLine = simById[line.id];
    const effectiveLoad = simLine?.effectiveLoad ?? ((line.load || 0) / 100);

    return {
      ...line,
      effectiveLoad,
      effectiveStatus: loadStatus(effectiveLoad),
      degraded: simLine?.degraded ?? false,
    };
  });

  const modes = ["Metro", "Tram", "Bus", "Rail", "Taxi", "Micromobility"];

  const grouped = modes
    .map((mode) => ({
      mode,
      lines: effectiveLines.filter((l: any) => l.mode === mode),
    }))
    .filter((g) => g.lines.length > 0);

  const degraded = effectiveLines.filter((l: any) => l.effectiveStatus !== "ok").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          {CITY_CONFIG.operator} · Network Overview
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {effectiveLines.length} active lines · {degraded} degraded
        </div>
      </div>

      <div
        style={{
          height: 360,
          background: "#161b26",
          border: "1px solid #2a3347",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <NetworkMapView focusSelectedOnly={!!expandedDisruptionId} autoZoomSelected={true} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {grouped.map((group) => (
          <div
            key={group.mode}
            style={{
              background: "#161b26",
              border: "1px solid #2a3347",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #2a3347",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {group.mode}
              </span>

              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {group.lines.length} lines
              </span>
            </div>

            <div>
              {group.lines.map((line: any, index: number) => {
                const linkedDisruptions = sim.disruptions.filter((d: any) =>
                  disruptionMatchesLine(d, line)
                );
                const primaryDisruption = linkedDisruptions[0] || null;
                const isExpanded =
                  primaryDisruption && expandedDisruptionId === String(primaryDisruption.id);

                return (
                <div
                  key={line.id}
                  onClick={() => {
                    if (!primaryDisruption) return;

                    const id = String(primaryDisruption.id);
                    const next = expandedDisruptionId === id ? null : id;

                    setExpandedDisruptionId(next);
                    setSelectedId(next);
                  }}
                  style={{
                    padding: 16,
                    borderTop: index === 0 ? "none" : "1px solid #2a3347",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    cursor: primaryDisruption ? "pointer" : "default",
                    background: isExpanded ? "rgba(14, 165, 233, 0.10)" : "transparent",
                    boxShadow: isExpanded ? "inset 3px 0 0 #38bdf8" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                          {line.id}
                        </div>
                        {primaryDisruption && (
                          <span
                            style={{
                              fontSize: 10,
                              border: "1px solid #7f1d1d",
                              background: "#450a0a",
                              color: "#fecaca",
                              borderRadius: 999,
                              padding: "3px 7px",
                              fontWeight: 900,
                            }}
                          >
                            Disruption
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {line.name}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: statusColor(line.effectiveStatus),
                        textTransform: "capitalize",
                      }}
                    >
                      {line.effectiveStatus}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>Frequency</span>
                    <span style={{ color: "#e2e8f0" }}>{line.frequency}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>Load</span>
                    <span style={{ color: "#e2e8f0" }}>{Math.round(line.effectiveLoad * 100)}%</span>
                  </div>

                  <div
                    style={{
                      height: 6,
                      background: "#2a3347",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.round(line.effectiveLoad * 100))}%`,
                        height: 6,
                        background: loadBarColor(line.effectiveLoad),
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  {isExpanded && primaryDisruption && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: 12,
                        border: "1px solid #334155",
                        borderRadius: 10,
                        background: "#020617",
                        color: "#cbd5e1",
                        fontSize: 12,
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900, color: "#e2e8f0" }}>
                          {primaryDisruption.title || primaryDisruption.id}
                        </div>
                        <div style={{ color: statusColor(line.effectiveStatus), fontWeight: 900 }}>
                          {line.effectiveStatus}
                        </div>
                      </div>

                      <div style={{ marginTop: 8 }}>
                        {summarizeDisruption(primaryDisruption)}
                      </div>

                      <div style={{ marginTop: 8, color: "#94a3b8" }}>
                        Location: {primaryDisruption.location || "Unknown"} · Click row again to clear focus.
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
