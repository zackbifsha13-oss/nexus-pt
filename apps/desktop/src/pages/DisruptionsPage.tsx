import { useEffect, useState } from "react";
import NetworkMapView from "../components/NetworkMapView";
import { getCityData, subscribeCity } from "../data/cityData";
import { getSelectedId, setSelectedId as setGlobalSelectedId, subscribeSelection } from "../state/selectionStore";
import { markDisruptionStabilizing, escalateDisruption, closeDisruption, subscribeDisruptionActions } from "../state/disruptionActionStore";
import { navigate } from "../state/navigationStore";
import { getSelectedProposalId, setSelectedProposalId, subscribeProposalSelection } from "../state/proposalSelectionStore";

type Severity = "critical" | "high" | "medium" | "low";
type DisruptionStatus = "active" | "stabilizing" | "resolved";

const SEVERITY_CONFIG: Record<Severity, { dot: string; badge: string; label: string }> = {
  critical: { dot: "bg-crit",  badge: "bg-crit/10 text-crit border-crit/30",  label: "Critical" },
  high:     { dot: "bg-warn",  badge: "bg-warn/10 text-warn border-warn/30",  label: "High"     },
  medium:   { dot: "bg-info",  badge: "bg-info/10 text-info border-info/30",  label: "Medium"   },
  low:      { dot: "bg-ok",    badge: "bg-ok/10 text-ok border-ok/30",        label: "Low"      },
};

const STATUS_CONFIG: Record<DisruptionStatus, { label: string; color: string }> = {
  active:      { label: "Active",      color: "text-crit" },
  stabilizing: { label: "Stabilizing", color: "text-warn" },
  resolved:    { label: "Resolved",    color: "text-ok"   },
};

function sqDist(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function nearestStopsForDetail(cityData: any, detail: any) {
  const loc = cityData.MAP?.locations?.[detail.location];
  if (!loc) return [];

  const stopsByLine = cityData.MAP?.transitStops || {};
  const lineCandidates = Object.entries(stopsByLine).flatMap(([lineId, stops]: any) =>
    (Array.isArray(stops) ? stops : []).map((stop: any) => ({
      ...stop,
      lineId,
      dist: Array.isArray(stop.coordinates) ? sqDist(loc, stop.coordinates) : Number.MAX_VALUE,
    }))
  );

  lineCandidates.sort((a, b) => a.dist - b.dist);
  return lineCandidates.slice(0, 4);
}

function normalizeLineKey(line?: string) {
  const raw = String(line || "").toUpperCase();
  if (raw.includes("M1")) return "M1";
  if (raw.includes("M2")) return "M2";
  if (raw.includes("M3")) return "M3";
  if (raw.includes("T4")) return "T4";
  if (raw.includes("040")) return "B040";
  if (raw.includes("224")) return "B224";
  if (raw.includes("X95")) return "BX95";
  if (raw.includes("METRO")) return "METRO";
  return null;
}

function fallbackLinesFor(line?: string) {
  const key = normalizeLineKey(line);
  const map: Record<string, string[]> = {
    M1: ["M2", "B040"],
    M2: ["M1", "M3", "B040"],
    M3: ["M2", "BX95"],
    T4: ["B040", "BX95"],
    B040: ["M1", "M2", "M3"],
    B224: ["B040"],
    BX95: ["M3", "B040"],
    METRO: [],
  };
  return key ? (map[key] || []) : [];
}

function describeEffects(p: any) {
  const fx = p.effects || {};
  const parts: string[] = [];

  if (typeof fx.severityDelta === "number" && fx.severityDelta < 0) {
    parts.push(`severity ${Math.round(Math.abs(fx.severityDelta) * 100)}% down`);
  }

  if (typeof fx.durationDeltaMin === "number" && fx.durationDeltaMin < 0) {
    parts.push(`${Math.abs(fx.durationDeltaMin)} min faster recovery`);
  }

  if (fx.resolveAtAcceptance) {
    parts.push("resolves incident");
  }

  if (typeof p.passengerMinutesSaved === "number" && p.passengerMinutesSaved > 0) {
    parts.push(`${p.passengerMinutesSaved.toLocaleString()} pax·min saved`);
  }

  return parts;
}

const SORT_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function DisruptionsPage() {
  const [, forceUpdate] = useState(0);
  const initialData = getCityData();
  const initialId = getSelectedId() || initialData.DISRUPTIONS[0]?.id || "";
  const [selectedId, setSelectedId] = useState<string>(initialId);

  useEffect(() => {
    const unsubCity = subscribeCity(() => {
      const data = getCityData();
      const nextId = data.DISRUPTIONS[0]?.id || "";
      setSelectedId(nextId);
      setGlobalSelectedId(nextId || null);
      forceUpdate((x) => x + 1);
    });

    const unsubSelection = subscribeSelection(() => {
      const globalId = getSelectedId();
      if (globalId) {
        setSelectedId(globalId);
      }
      forceUpdate((x) => x + 1);
    });

    return () => {
      unsubCity();
      unsubSelection();
    };
  }, []);

  const { DISRUPTIONS, INTERVENTIONS, CITY_CONFIG } = getCityData();

  const safeSelectedId =
    DISRUPTIONS.find((d: any) => d.id === selectedId)?.id ||
    DISRUPTIONS[0]?.id ||
    "";

  const sorted = [...DISRUPTIONS].sort(
    (a: any, b: any) => SORT_ORDER[a.severity as Severity] - SORT_ORDER[b.severity as Severity]
  );

  const detail = DISRUPTIONS.find((d: any) => d.id === safeSelectedId) || DISRUPTIONS[0];
  const proposals = INTERVENTIONS.filter((i: any) => i.disruptionId === safeSelectedId);

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-dim">
        No disruptions available for {CITY_CONFIG.name}.
      </div>
    );
  }

  const sev = SEVERITY_CONFIG[detail.severity as Severity];
  const sta = STATUS_CONFIG[detail.status as DisruptionStatus];
  const nearestStops = nearestStopsForDetail(getCityData(), detail);
  const fallbackLines = fallbackLinesFor(detail.line);

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-72 shrink-0 flex flex-col bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-dim uppercase tracking-wider">All Incidents</p>
          <span className="text-xs text-crit font-medium">
            {DISRUPTIONS.filter((d: any) => d.status === "active").length} active
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {sorted.map((d: any) => {
            const s = SEVERITY_CONFIG[d.severity as Severity];
            const active = d.id === safeSelectedId;

            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedId(d.id);
                  setGlobalSelectedId(d.id);
                }}
                className={[
                  "w-full text-left px-4 py-3 transition-colors hover:bg-muted",
                  active ? "bg-muted border-l-2 border-l-accent" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-xs font-mono font-semibold text-sub shrink-0">
                      {String(d.mode).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-xs text-dim truncate">{d.mode}</span>
                  </div>
                  <span className="text-xs font-mono text-dim shrink-0">{d.timestamp}</span>
                </div>

                <p className="text-sm font-medium text-text leading-snug mb-1 line-clamp-2">
                  {d.title}
                </p>

                <p className="text-xs text-dim mb-1.5">{d.location}</p>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${s.badge}`}>
                    {s.label}
                  </span>
                  <span className="text-xs text-dim tabular-nums">
                    {d.affectedPax.toLocaleString()} pax
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-panel border border-border rounded-lg overflow-hidden min-w-0">
        <div className="h-64 border-b border-border shrink-0">
          <NetworkMapView focusSelectedOnly={true} autoZoomSelected={true} />
        </div>

        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sev.dot}`} />
              <span className="text-xs font-mono text-sub">{detail.mode}</span>
              <span className="text-xs text-dim">·</span>
              <span className="text-xs text-dim">{detail.line}</span>
            </div>
            <span className="text-xs font-mono text-dim shrink-0">{detail.id}</span>
          </div>

          <h2 className="text-base font-semibold text-text leading-snug mb-1">
            {detail.title}
          </h2>
          <p className="text-sm text-dim">{detail.location}</p>
        </div>

        <div className="grid grid-cols-4 gap-px bg-border shrink-0">
          {[
            { label: "Severity",     value: sev.label,                           cls: sev.badge.split(" ")[1] ?? "text-text" },
            { label: "Status",       value: sta.label,                           cls: sta.color },
            { label: "Pax Affected", value: detail.affectedPax.toLocaleString(), cls: "text-text" },
            { label: "Reported",     value: detail.timestamp,                    cls: "text-text" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-panel px-4 py-3">
              <p className="text-xs text-dim mb-1">{label}</p>
              <p className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${sev.badge}`}>
              {sev.label}
            </span>
            <span className={`text-xs font-medium ${sta.color}`}>{sta.label}</span>
            <span className="text-xs text-dim px-2 py-0.5 rounded border border-border bg-muted">
              {detail.mode}
            </span>
            <span className="text-xs text-dim px-2 py-0.5 rounded border border-border bg-muted">
              {CITY_CONFIG.name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-xs text-dim uppercase tracking-wider mb-2">Operational Context</p>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-dim">Line</span>
                  <span className="text-text font-medium">{detail.line}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-dim">Status</span>
                  <span className={sta.color}>{sta.label}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-dim">Affected Pax</span>
                  <span className="text-text font-medium">{detail.affectedPax.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-xs text-dim uppercase tracking-wider mb-2">Nearest Stops</p>
              {nearestStops.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {nearestStops.map((stop: any) => (
                    <div key={`${stop.lineId}-${stop.id}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-sub truncate">{stop.name}</span>
                      <span className="text-xs text-dim shrink-0">{stop.lineId}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dim">No nearby stops found.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-dim uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-sub leading-relaxed">{detail.description}</p>
          </div>

          <div>
            <p className="text-xs text-dim uppercase tracking-wider mb-3">Incident Timeline</p>
            <div className="flex flex-col">
              {detail.timeline.map((event: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${i === 0 ? sev.dot : "bg-muted border border-border"}`} />
                    {i < detail.timeline.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1 mb-1" />
                    )}
                  </div>
                  <div className={i === detail.timeline.length - 1 ? "pb-0" : "pb-4"}>
                    <span className="text-xs font-mono text-dim">{event.time}</span>
                    <p className="text-sm text-sub mt-0.5">{event.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {proposals.length > 0 && (
            <div>
              <p className="text-xs text-dim uppercase tracking-wider mb-3">
                Linked Interventions ({proposals.length})
              </p>
              <div className="flex flex-col gap-2">
                {proposals.map((p: any) => {
                  const effectBits = describeEffects(p);

                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProposalId(getSelectedProposalId() === p.id ? null : p.id)}
                      className={[
                        "w-full text-left bg-surface border rounded-lg p-3 transition-colors",
                        getSelectedProposalId() === p.id
                          ? "border-cyan-300 bg-cyan-950/30"
                          : "border-border hover:bg-muted"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-text">{p.action}</span>
                        <span className="text-xs font-mono text-dim shrink-0">#{p.rank}</span>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-dim">Pax·min saved</span>
                        <span className="text-xs font-semibold text-ok tabular-nums">
                          +{p.passengerMinutesSaved.toLocaleString()}
                        </span>
                      </div>

                      {(detail.fromStop?.name && detail.toStop?.name) && (
                        <div className="mb-2 text-xs text-dim">
                          Stop pair: <span className="text-sub">{detail.fromStop.name} → {detail.toStop.name}</span>
                        </div>
                      )}

                      {fallbackLines.length > 0 && (
                        <div className="mb-2 text-xs text-dim">
                          Fallback lines: <span className="text-sub">{fallbackLines.join(", ")}</span>
                        </div>
                      )}

                      {effectBits.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {effectBits.map((bit) => (
                            <span
                              key={bit}
                              className="text-2xs px-2 py-0.5 rounded border border-border bg-muted text-sub"
                            >
                              {bit}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-sub leading-relaxed">{p.rationale}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {detail.status !== "resolved" && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setGlobalSelectedId(detail.id);
                  navigate("interventions" as any);
                }}
                className="px-4 py-1.5 rounded bg-accent text-black text-sm font-medium hover:opacity-90 transition-opacity"
              >
                View Proposals
              </button>
              <button
                onClick={() => markDisruptionStabilizing(detail.id)}
                className="px-4 py-1.5 rounded border border-border text-sm text-sub hover:bg-muted hover:text-text transition-colors"
              >
                Mark Stabilizing
              </button>
              <button
                onClick={() => escalateDisruption(detail.id)}
                className="px-4 py-1.5 rounded border border-border text-sm text-sub hover:bg-muted hover:text-text transition-colors"
              >
                Escalate
              </button>
              <button
                onClick={() => closeDisruption(detail.id)}
                className="px-4 py-1.5 rounded border border-border text-sm text-sub hover:bg-muted hover:text-text transition-colors"
              >
                Close Incident
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
