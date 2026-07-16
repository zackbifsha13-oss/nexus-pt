import fs from "fs";
import path from "path";

const base = path.resolve("data/oasa_parts");

function mustRead(name) {
  const p = path.join(base, name);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${name} in data/oasa_parts`);
  }
  return fs.readFileSync(p, "utf8");
}

function parseCsv(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((r) => r.length && r.some((x) => x !== ""))
    .map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""])));
}

const routes = parseCsv(mustRead("routes.txt"));
const stops = parseCsv(mustRead("stops.txt"));
const trips = parseCsv(mustRead("trips.txt"));
const shapes = parseCsv(mustRead("shapes.txt"));
const stopTimes = parseCsv(mustRead("stop_times.txt"));

const stopsById = Object.fromEntries(
  stops.map((s) => [
    s.stop_id,
    {
      id: s.stop_id,
      name: s.stop_name,
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
    },
  ])
);

const routesById = Object.fromEntries(
  routes.map((r) => [
    r.route_id,
    {
      id: r.route_id,
      shortName: r.route_short_name || r.route_id,
      longName: r.route_long_name || "",
      type: r.route_type || "",
    },
  ])
);

const tripsByRoute = {};
for (const t of trips) {
  const routeId = t.route_id;
  if (!tripsByRoute[routeId]) tripsByRoute[routeId] = [];
  tripsByRoute[routeId].push(t);
}

const stopTimesByTrip = {};
for (const st of stopTimes) {
  if (!stopTimesByTrip[st.trip_id]) stopTimesByTrip[st.trip_id] = [];
  stopTimesByTrip[st.trip_id].push(st);
}
for (const tripId of Object.keys(stopTimesByTrip)) {
  stopTimesByTrip[tripId].sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
}

const shapesById = {};
for (const sh of shapes) {
  if (!shapesById[sh.shape_id]) shapesById[sh.shape_id] = [];
  shapesById[sh.shape_id].push(sh);
}
for (const shapeId of Object.keys(shapesById)) {
  shapesById[shapeId].sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence));
}

function representativeTrip(routeId) {
  const list = tripsByRoute[routeId] || [];
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const aLen = (stopTimesByTrip[a.trip_id] || []).length;
    const bLen = (stopTimesByTrip[b.trip_id] || []).length;
    return bLen - aLen;
  })[0];
}

const generatedLines = {};
const generatedStops = {};
const generatedEndpoints = {};

for (const route of routes) {
  const r = routesById[route.route_id];
  const trip = representativeTrip(route.route_id);
  if (!trip) continue;

  const key = r.shortName;
  const tripStops = stopTimesByTrip[trip.trip_id] || [];

  if (trip.shape_id && shapesById[trip.shape_id]?.length) {
    generatedLines[key] = shapesById[trip.shape_id].map((p) => [Number(p.shape_pt_lon), Number(p.shape_pt_lat)]);
  } else {
    generatedLines[key] = tripStops
      .map((st) => stopsById[st.stop_id])
      .filter(Boolean)
      .map((s) => [s.lon, s.lat]);
  }

  generatedStops[key] = tripStops
    .map((st) => stopsById[st.stop_id])
    .filter(Boolean)
    .map((s) => ({
      id: s.id,
      name: s.name,
      coordinates: [s.lon, s.lat],
    }));

  const first = generatedStops[key][0];
  const last = generatedStops[key][generatedStops[key].length - 1];
  if (first && last) {
    generatedEndpoints[key] = { from: first, to: last };
  }
}

const out = `export const ATHENS_GTFS_LINES = ${JSON.stringify(generatedLines, null, 2)} as const;

export const ATHENS_GTFS_STOPS = ${JSON.stringify(generatedStops, null, 2)} as const;

export const ATHENS_GTFS_ENDPOINTS = ${JSON.stringify(generatedEndpoints, null, 2)} as const;
`;

fs.writeFileSync("src/data/gtfs/athens-gtfs.generated.ts", out);
console.log("Generated src/data/gtfs/athens-gtfs.generated.ts");
console.log("Routes:", Object.keys(generatedLines).length);
