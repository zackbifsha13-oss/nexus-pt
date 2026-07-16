import { ATHENS_ROAD_CACHE } from "../data/road-cache/athens-road-cache";
import { THESSALONIKI_ROAD_CACHE } from "../data/road-cache/thessaloniki-road-cache";
import { ROAD_GEOMETRY_MODE, ROAD_MATCH_RADII, type RoadGeometryMode } from "../data/road-match-config";

type Listener = () => void;

type GeometryState = {
  loading: Record<string, boolean>;
  geometries: Record<string, [number, number][]>;
  errors: Record<string, string | null>;
};

const listeners: Listener[] = [];

const PRELOADED_CACHE: Record<string, [number, number][]> = {
  ...ATHENS_ROAD_CACHE,
  ...THESSALONIKI_ROAD_CACHE,
};

const state: GeometryState = {
  loading: {},
  geometries: { ...PRELOADED_CACHE },
  errors: {},
};

function emit() {
  listeners.forEach((l) => l());
}

function getToken() {
  return ((import.meta as any)?.env?.VITE_MAPBOX_TOKEN as string) || "";
}

function profileForMode(mode?: string) {
  const m = String(mode || "").toLowerCase();
  if (m === "micromobility") return "cycling";
  return "driving-traffic";
}

function buildKey(cityId: string, featureId: string, profile: string, method: RoadGeometryMode) {
  return `${cityId}:${featureId}:${profile}:${method}`;
}

function getMethod(featureId: string): RoadGeometryMode {
  return ROAD_GEOMETRY_MODE[featureId] || "directions";
}

async function fetchDirectionsGeometry(profile: string, coords: [number, number][], token: string) {
  const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Directions failed: ${res.status}`);
  }

  const data = await res.json();
  const geometry = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(geometry) || geometry.length < 2) {
    throw new Error("No route geometry returned");
  }

  return geometry as [number, number][];
}

async function fetchMatchedGeometry(profile: string, featureId: string, coords: [number, number][], token: string) {
  const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const radii = ROAD_MATCH_RADII[featureId];
  const radiusesParam =
    Array.isArray(radii) && radii.length === coords.length
      ? `&radiuses=${radii.join(";")}`
      : "";

  const url =
    `https://api.mapbox.com/matching/v5/mapbox/${profile}/${coordStr}` +
    `.json?geometries=geojson&overview=full&steps=false&tidy=true${radiusesParam}` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Map Matching failed: ${res.status}`);
  }

  const data = await res.json();
  const geometry = data?.matchings?.[0]?.geometry?.coordinates;
  if (!Array.isArray(geometry) || geometry.length < 2) {
    throw new Error("No matched geometry returned");
  }

  return geometry as [number, number][];
}

export function getRoadGeometry(key: string) {
  return state.geometries[key] || null;
}

export function getRoadGeometryState() {
  return state;
}

export function subscribeRoadGeometry(listener: Listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function ensureRoadGeometry(
  cityId: string,
  featureId: string,
  mode: string | undefined,
  seedCoords: [number, number][]
) {
  const token = getToken();
  const profile = profileForMode(mode);
  const method = getMethod(featureId);
  const key = buildKey(cityId, featureId, profile, method);

  if (state.geometries[key]) {
    return key;
  }

  if (!token || !Array.isArray(seedCoords) || seedCoords.length < 2 || state.loading[key]) {
    return key;
  }

  state.loading[key] = true;
  state.errors[key] = null;
  emit();

  try {
    const geometry =
      method === "map-matching"
        ? await fetchMatchedGeometry(profile, featureId, seedCoords, token)
        : await fetchDirectionsGeometry(profile, seedCoords, token);

    state.geometries[key] = geometry;
  } catch (err: any) {
    state.errors[key] = err?.message || "Road geometry fetch failed";
  } finally {
    state.loading[key] = false;
    emit();
  }

  return key;
}

export function roadGeometryKey(cityId: string, featureId: string, mode?: string) {
  const profile = profileForMode(mode);
  const method = getMethod(featureId);
  return buildKey(cityId, featureId, profile, method);
}
