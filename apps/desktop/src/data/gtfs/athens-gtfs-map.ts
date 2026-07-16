import {
  ATHENS_GTFS_LINES,
  ATHENS_GTFS_STOPS,
  ATHENS_GTFS_ENDPOINTS,
} from "./athens-gtfs.generated";

function pickFirst(...keys: string[]) {
  for (const key of keys) {
    if ((ATHENS_GTFS_LINES as any)[key]) return key;
  }
  return null;
}

export const ATHENS_GTFS_LINE_MAP = {
  M1: pickFirst("1"),
  M2: pickFirst("2"),
  M3: pickFirst("3"),
  T4: pickFirst("T4", "4"),
  B040: pickFirst("040", "40"),
  B224: pickFirst("224"),
  BX95: pickFirst("X95", "95"),
} as const;

export const ATHENS_GTFS_MAPPED_LINES = Object.fromEntries(
  Object.entries(ATHENS_GTFS_LINE_MAP)
    .filter(([, gtfsKey]) => !!gtfsKey && (ATHENS_GTFS_LINES as any)[gtfsKey as string])
    .map(([lineId, gtfsKey]) => [lineId, (ATHENS_GTFS_LINES as any)[gtfsKey as string]])
);

export const ATHENS_GTFS_MAPPED_STOPS = Object.fromEntries(
  Object.entries(ATHENS_GTFS_LINE_MAP)
    .filter(([, gtfsKey]) => !!gtfsKey && (ATHENS_GTFS_STOPS as any)[gtfsKey as string])
    .map(([lineId, gtfsKey]) => [lineId, (ATHENS_GTFS_STOPS as any)[gtfsKey as string]])
);

export const ATHENS_GTFS_MAPPED_ENDPOINTS = Object.fromEntries(
  Object.entries(ATHENS_GTFS_LINE_MAP)
    .filter(([, gtfsKey]) => !!gtfsKey && (ATHENS_GTFS_ENDPOINTS as any)[gtfsKey as string])
    .map(([lineId, gtfsKey]) => [lineId, (ATHENS_GTFS_ENDPOINTS as any)[gtfsKey as string]])
);
