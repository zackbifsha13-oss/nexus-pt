import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { getCityData, subscribeCity } from "../data/cityData";
import { getSelectedId, subscribeSelection } from "../state/selectionStore";
import { subscribeTimeline, getTimelineState } from "../state/timelineStore";
import { subscribeInterventions } from "../state/interventionStore";
import { getSimulationState } from "../simulation/simulationEngine";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [error, setError] = useState<string>("");

  function clearMarkers() {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }

  function renderMarkers() {
    const map = mapRef.current;
    if (!map) return;

    const city = getCityData();
    const selectedId = getSelectedId();

    const sim = getSimulationState(
      city.CITY_CONFIG.id,
      getTimelineState().currentMinute
    );

    clearMarkers();

    sim.disruptions.forEach((d: any) => {
      const coords = city.MAP.locations?.[d.location];
      if (!coords) return;

      const isSelected = d.id === selectedId;

      const el = document.createElement("div");
      el.style.width = isSelected ? "18px" : "12px";
      el.style.height = isSelected ? "18px" : "12px";
      el.style.borderRadius = "999px";

      // 🔴 intensity based on severity
      const intensity = d.effectiveSeverity ?? 1;
      const alpha = Math.max(0.3, intensity);

      el.style.background = `rgba(239,68,68,${alpha})`;
      el.style.border = isSelected
        ? "3px solid #fff"
        : "2px solid rgba(255,255,255,0.6)";

      el.style.boxShadow = isSelected
        ? "0 0 0 10px rgba(239,68,68,0.25)"
        : `0 0 0 6px rgba(239,68,68,${alpha * 0.25})`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      markersRef.current.push(marker);

      if (isSelected) {
        map.easeTo({
          center: coords,
          duration: 600,
          zoom: Math.max(map.getZoom(), 12.5),
        });
      }
    });
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const { MAP } = getCityData();

    const timer = setTimeout(() => {
      try {
        const map = new mapboxgl.Map({
          container: el,
          style: "mapbox://styles/mapbox/dark-v11",
          center: MAP.center,
          zoom: MAP.zoom,
          attributionControl: false,
        });

        map.on("error", (e: any) => {
          setError(e?.message || "Map error");
        });

        map.on("load", () => {
          map.resize();
          renderMarkers();
        });

        const ro = new ResizeObserver(() => map.resize());
        ro.observe(el);

        mapRef.current = map;
        (mapRef.current as any).__ro = ro;
      } catch (err: any) {
        setError(err?.message || "Map init failed");
      }
    }, 200);

    return () => {
      clearMarkers();
      const map = mapRef.current as any;
      if (map?.__ro) map.__ro.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const rerender = () => {
      if (mapRef.current?.loaded()) {
        renderMarkers();
      }
    };

    const unsub1 = subscribeSelection(rerender);
    const unsub2 = subscribeCity(rerender);
    const unsub3 = subscribeTimeline(rerender);
    const unsub4 = subscribeInterventions(rerender);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {false && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fca5a5"
        }}>
          Missing VITE_MAPBOX_TOKEN
        </div>
      )}

      {!!error && (
        <div style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          right: 10,
          background: "rgba(127,29,29,0.9)",
          color: "#fff",
          padding: 8,
          borderRadius: 6,
          fontSize: 12
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
