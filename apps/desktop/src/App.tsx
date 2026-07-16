import { useEffect, useState } from "react";

import DashboardPage from "./pages/DashboardPage";
import NetworkPage from "./pages/NetworkPage";
import DisruptionsPage from "./pages/DisruptionsPage";
import InterventionsPage from "./pages/InterventionsPage";
import AuditLogPage from "./pages/AuditLogPage";

import { getNavigation, navigate, subscribeNavigation } from "./state/navigationStore";
import { getCityData, setCity, subscribeCity } from "./data/cityData";
import { subscribeTimeline } from "./state/timelineStore";
import TimelineControls from "./components/TimelineControls";
import { evaluatePendingOutcomes } from "./state/outcomeEvaluator";
import { ensureLiveTrafficPolling, stopLiveTrafficPolling, subscribeLiveTraffic } from "./state/liveTrafficStore";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "network", label: "Network" },
  { id: "disruptions", label: "Disruptions" },
  { id: "interventions", label: "Interventions" },
  { id: "audit-log", label: "Audit Log" },
];

export default function App() {
  const [nav, setNav] = useState(getNavigation());
  const [cityId, setCityId] = useState(getCityData().CITY_CONFIG.id);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubNav = subscribeNavigation(() => {
      setNav(getNavigation());
    });

    const unsubCity = subscribeCity(() => {
      setCityId(getCityData().CITY_CONFIG.id);
      forceUpdate((x) => x + 1);
    });

    const unsubTimeline = subscribeTimeline(() => {
      evaluatePendingOutcomes();
      forceUpdate((x) => x + 1);
    });

    const unsubTraffic = subscribeLiveTraffic(() => {
      evaluatePendingOutcomes();
      forceUpdate((x) => x + 1);
    });

    return () => {
      unsubNav();
      unsubCity();
      unsubTimeline();
      unsubTraffic();
    };
  }, []);

  useEffect(() => {
    ensureLiveTrafficPolling(cityId);
    return () => {
      stopLiveTrafficPolling(cityId);
    };
  }, [cityId]);

  function renderPage() {
    switch (nav.page) {
      case "network":
        return <NetworkPage />;
      case "disruptions":
        return <DisruptionsPage />;
      case "interventions":
        return <InterventionsPage />;
      case "audit-log":
        return <AuditLogPage />;
      case "dashboard":
      default:
        return <DashboardPage />;
    }
  }

  const cityData = getCityData();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f1117", color: "white" }}>
      <aside
        style={{
          width: 240,
          background: "#161b26",
          borderRight: "1px solid #2a3347",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Transit Console</h2>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            {cityData.CITY_CONFIG.name} · {cityData.CITY_CONFIG.operator}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {cityData.CITY_CONFIG.center || "Operations Control Centre"}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <select
            value={cityId}
            onChange={(e) => setCity(e.target.value)}
            style={{
              width: "100%",
              background: "#0f1117",
              color: "white",
              border: "1px solid #2a3347",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <option value="athens">Athens</option>
            <option value="nea_smyrni">Nea Smyrni</option>
            <option value="thessaloniki">Thessaloniki</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id as any)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #2a3347",
                background: nav.page === item.id ? "#252e3f" : "transparent",
                color: "white",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            minHeight: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "10px 20px",
            background: "#161b26",
            borderBottom: "1px solid #2a3347",
          }}
        >
          <h1 style={{ fontSize: 16, margin: 0 }}>
            {String(nav.page).charAt(0).toUpperCase() + String(nav.page).slice(1)}
          </h1>
          <TimelineControls />
        </header>

        <main style={{ flex: 1, padding: 20, overflow: "auto" }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
