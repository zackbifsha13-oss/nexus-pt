import { useEffect, useState } from "react";
import { getCityData } from "../data/cityData";
import { getSimulationState } from "../simulation/simulationEngine";
import { subscribeInterventions } from "../state/interventionStore";
import { subscribeTimeline, getTimelineState } from "../state/timelineStore";

function statusTone(status: string) {
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

export default function DashboardPage() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const rerender = () => forceUpdate((x) => x + 1);

    const unsubInterventions = subscribeInterventions(rerender);
    const unsubTimeline = subscribeTimeline(rerender);

    return () => {
      unsubInterventions();
      unsubTimeline();
    };
  }, []);

  const city = getCityData();
  const sim = getSimulationState(city.CITY_CONFIG.id, getTimelineState().currentMinute);

  const active = sim.disruptions;
  const network = sim.network;

  const activeCritical = active.filter((d) => d.effectiveSeverity >= 0.9).length;

  const stats = [
    {
      label: "Active Disruptions",
      value: String(sim.totals.activeDisruptions),
      sub: activeCritical > 0 ? `${activeCritical} critical` : "network wide",
      status: activeCritical > 0 ? "crit" : "warn",
    },
    {
      label: "Pax Affected",
      value: Math.floor(sim.totals.paxAffected).toLocaleString(),
      sub: "real-time simulation",
      status: sim.totals.paxAffected > 5000 ? "warn" : "info",
    },
    {
      label: "Pax·Min Saved",
      value: sim.totals.paxMinSaved.toLocaleString(),
      sub: "accepted interventions",
      status: "ok",
    },
    {
      label: "Accepted Interventions",
      value: String(sim.totals.acceptedInterventions),
      sub: "operator decisions",
      status: sim.totals.acceptedInterventions > 0 ? "info" : "ok",
    },
  ];

  const degradedLines = network.filter((l) => l.degraded);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, color: "#94a3b8", fontSize: 12 }}>
          <span>{city.CITY_CONFIG.operator}</span>
          <span>·</span>
          <span>{city.CITY_CONFIG.center || "Operations Control Centre"}</span>
        </div>

        <span style={{ color: "#94a3b8", fontSize: 12 }}>
          {city.CITY_CONFIG.name}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#161b26",
              border: "1px solid #2a3347",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {stat.label}
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: statusTone(stat.status),
              }}
            >
              {stat.value}
            </div>

            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div
          style={{
            flex: 1,
            background: "#161b26",
            border: "1px solid #2a3347",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
            Network Health
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {degradedLines.slice(0, 5).map((line) => (
              <div key={line.lineId} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#cbd5e1" }}>{line.lineId}</span>
                <span style={{ color: "#f59e0b" }}>
                  {Math.round(line.effectiveLoad * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
