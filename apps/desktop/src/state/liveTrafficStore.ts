import { TRAFFIC_PROBES, type TrafficProbe } from "../data/trafficProbes";

type ProbeSnapshot = {
  probeId: string;
  lineId?: string;
  disruptionId?: string;
  delayScore: number;
  trafficDurationSec: number | null;
  baseDurationSec: number | null;
  label?: string;
};

type TrafficSnapshot = {
  cityId: string;
  isLoading: boolean;
  updatedAt: number | null;
  error: string | null;
  probes: ProbeSnapshot[];
  byLine: Record<string, number>;
  byDisruption: Record<string, number>;
};

type Listener = () => void;

const listeners: Listener[] = [];
const snapshots: Record<string, TrafficSnapshot> = {};
const timers: Record<string, number | null> = {};
const inFlight: Record<string, boolean> = {};

const REFRESH_MS = 8 * 60 * 1000;

function emit() {
  listeners.forEach((l) => l());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getToken() {
  return ((import.meta as any)?.env?.VITE_MAPBOX_TOKEN as string) || "";
}

function getCityProbes(cityId: string) {
  return TRAFFIC_PROBES.filter((p) => p.cityId === cityId);
}

async function getRouteDuration(profile: "driving" | "driving-traffic", from: [number, number], to: [number, number], token: string) {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?alternatives=false&geometries=geojson&overview=false&steps=false&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Directions ${profile} failed: ${res.status}`);
  }

  const data = await res.json();
  return data?.routes?.[0]?.duration ?? null;
}

async function sampleProbe(probe: TrafficProbe, token: string): Promise<ProbeSnapshot> {
  try {
    const [trafficDurationSec, baseDurationSec] = await Promise.all([
      getRouteDuration("driving-traffic", probe.from, probe.to, token),
      getRouteDuration("driving", probe.from, probe.to, token),
    ]);

    let delayScore = 0;

    if (typeof trafficDurationSec === "number" && typeof baseDurationSec === "number" && baseDurationSec > 0) {
      const extra = (trafficDurationSec - baseDurationSec) / baseDurationSec;
      delayScore = clamp(extra / 0.5, 0, 1);
    }

    return {
      probeId: probe.id,
      lineId: probe.lineId,
      disruptionId: probe.disruptionId,
      delayScore,
      trafficDurationSec,
      baseDurationSec,
      label: probe.label,
    };
  } catch {
    return {
      probeId: probe.id,
      lineId: probe.lineId,
      disruptionId: probe.disruptionId,
      delayScore: 0,
      trafficDurationSec: null,
      baseDurationSec: null,
      label: probe.label,
    };
  }
}

function aggregate(cityId: string, probes: ProbeSnapshot[]) {
  const byLine: Record<string, { total: number; weight: number }> = {};
  const byDisruption: Record<string, { total: number; weight: number }> = {};

  for (const probe of probes) {
    const config = TRAFFIC_PROBES.find((p) => p.id === probe.probeId);
    const weight = config?.weight ?? 1;

    if (probe.lineId) {
      byLine[probe.lineId] ||= { total: 0, weight: 0 };
      byLine[probe.lineId].total += probe.delayScore * weight;
      byLine[probe.lineId].weight += weight;
    }

    if (probe.disruptionId) {
      byDisruption[probe.disruptionId] ||= { total: 0, weight: 0 };
      byDisruption[probe.disruptionId].total += probe.delayScore * weight;
      byDisruption[probe.disruptionId].weight += weight;
    }
  }

  snapshots[cityId] = {
    cityId,
    isLoading: false,
    updatedAt: Date.now(),
    error: null,
    probes,
    byLine: Object.fromEntries(
      Object.entries(byLine).map(([k, v]) => [k, v.weight > 0 ? v.total / v.weight : 0])
    ),
    byDisruption: Object.fromEntries(
      Object.entries(byDisruption).map(([k, v]) => [k, v.weight > 0 ? v.total / v.weight : 0])
    ),
  };
}

export async function refreshLiveTraffic(cityId: string) {
  const token = getToken();
  const probes = getCityProbes(cityId);

  snapshots[cityId] ||= {
    cityId,
    isLoading: false,
    updatedAt: null,
    error: null,
    probes: [],
    byLine: {},
    byDisruption: {},
  };

  if (!token || probes.length === 0 || inFlight[cityId]) {
    emit();
    return;
  }

  inFlight[cityId] = true;
  snapshots[cityId].isLoading = true;
  emit();

  try {
    const results = await Promise.all(probes.map((probe) => sampleProbe(probe, token)));
    aggregate(cityId, results);
  } catch (err: any) {
    snapshots[cityId] = {
      ...snapshots[cityId],
      isLoading: false,
      error: err?.message || "Live traffic refresh failed",
    };
  } finally {
    inFlight[cityId] = false;
    snapshots[cityId].isLoading = false;
    emit();
  }
}

export function ensureLiveTrafficPolling(cityId: string) {
  if (timers[cityId]) return;

  refreshLiveTraffic(cityId);

  timers[cityId] = window.setInterval(() => {
    refreshLiveTraffic(cityId);
  }, REFRESH_MS);
}

export function stopLiveTrafficPolling(cityId: string) {
  const timer = timers[cityId];
  if (timer) {
    window.clearInterval(timer);
    timers[cityId] = null;
  }
}

export function getLiveTrafficSnapshot(cityId: string): TrafficSnapshot {
  return (
    snapshots[cityId] || {
      cityId,
      isLoading: false,
      updatedAt: null,
      error: null,
      probes: [],
      byLine: {},
      byDisruption: {},
    }
  );
}

export function subscribeLiveTraffic(listener: Listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
