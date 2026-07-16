export type RoadGeometryMode = "directions" | "map-matching";

export const ROAD_GEOMETRY_MODE: Record<string, RoadGeometryMode> = {
  "D-ATH-003": "map-matching",
  "D-ATH-005": "directions",
  "D-ATH-006": "map-matching",
  "D-ATH-007": "map-matching",
  "D-TH-001": "directions",
};

export const ROAD_MATCH_RADII: Record<string, number[]> = {
  "D-ATH-003": [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  "D-ATH-006": [25, 25, 25, 25, 25, 25, 25],
  "D-ATH-007": [30, 30, 30, 30, 30, 30],
};
