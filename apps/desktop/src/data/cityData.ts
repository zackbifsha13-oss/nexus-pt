import {
  DISRUPTIONS as ATH_DISRUPTIONS,
  INTERVENTIONS as ATH_INTERVENTIONS,
  NETWORK_LINES as ATH_LINES,
  CITY_CONFIG as ATH_CONFIG,
} from "./athensData";

import { getTimelineState } from "../state/timelineStore";
import { ATHENS_DISRUPTION_PATHS, THESSALONIKI_DISRUPTION_PATHS } from "./disruptionPaths";
import { ATHENS_GTFS_LINES, ATHENS_GTFS_STOPS, ATHENS_GTFS_ENDPOINTS } from "./gtfs/athens-gtfs.generated";
import { ATHENS_GTFS_MAPPED_LINES, ATHENS_GTFS_MAPPED_STOPS, ATHENS_GTFS_MAPPED_ENDPOINTS } from "./gtfs/athens-gtfs-map";
import { ATHENS_TRANSIT_SHAPES, ATHENS_ROAD_CORRIDORS, THESSALONIKI_TRANSIT_SHAPES, THESSALONIKI_ROAD_CORRIDORS } from "./networkGeometry";

export const CITY_DATA = {
  athens: {
    CITY_CONFIG: ATH_CONFIG,

    DISRUPTIONS: ATH_DISRUPTIONS.map((d, i) => ({
      ...d,
      startMinute:
        i === 0 ? 8 * 60 + 10 :
        i === 1 ? 8 * 60 + 40 :
        i === 2 ? 9 * 60 +  0 :
        i === 3 ? 9 * 60 + 20 :
        i === 4 ? 9 * 60 + 35 :
        8 * 60,
      endMinute:
        i === 0 ? 10 * 60 :
        i === 1 ? 9 * 60 + 50 :
        i === 2 ? 10 * 60 + 30 :
        i === 3 ? 10 * 60 :
        i === 4 ? 10 * 60 + 15 :
        9 * 60,
    })),

    INTERVENTIONS: ATH_INTERVENTIONS,
    NETWORK_LINES: ATH_LINES,

    MAP: {
      center: [23.7275, 37.9838],
      zoom: 11.5,

      locations: {
        "Monastiraki — Thissio": [23.7244, 37.9763],
        "Syntagma station": [23.7348, 37.9755],
        "Omonia — Stadiou St": [23.7281, 37.9842],
        "Faliro — SEF interchange": [23.6658, 37.9429],
        "Attiki Odos — Pallini interchange": [23.8762, 38.0056],
        "Kifissia — Plateia Platanon": [23.8081, 38.0740],
        "Kolonaki — Dexameni": [23.7432, 37.9816],
        "Dafni — Agios Ioannis segment": [23.7347, 37.9495],
      },

      lines: {
        M1: [[23.7207,37.9789],[23.7244,37.9763],[23.7304,37.9735]],
        M2: [[23.7342,37.9759],[23.7342,37.9568]],
        M3: [[23.7106,37.9801],[23.7348,37.9755],[23.7825,37.9931]],
        T4: [[23.7347,37.9754],[23.6658,37.9429]],
        X95: [[23.7348,37.9755],[23.8780,37.9950]],
      },

      disruptionPaths: ATHENS_DISRUPTION_PATHS,
      transitShapes: {
        ...ATHENS_TRANSIT_SHAPES,
        ...ATHENS_GTFS_MAPPED_LINES,
        ...ATHENS_GTFS_LINES,
      },
      transitStops: {
        ...ATHENS_GTFS_MAPPED_STOPS,
      },
      transitEndpoints: {
        ...ATHENS_GTFS_MAPPED_ENDPOINTS,
      },
      roadCorridors: ATHENS_ROAD_CORRIDORS,
    },
  },

  nea_smyrni: {
    CITY_CONFIG: {
      id: "nea_smyrni",
      name: "Nea Smyrni",
      operator: "OASA",
    },

    DISRUPTIONS: [
      {
        id: "D-NS-001",
        mode: "Bus",
        line: "A2 / 106 / 126",
        title: "Nea Smyrni corridor crowding",
        location: "Nea Smyrni Square",
        severity: 0.62,
        effectiveSeverity: 0.62,
        affectedPax: 1450,
        status: "active",
        timestamp: "09:05",
        description: "Surface transit crowding around Nea Smyrni Square with spillover toward Syngrou Avenue.",
        timeline: [],
        startMinute: 8 * 60,
        endMinute: 11 * 60,
      },
    ],

    INTERVENTIONS: [
      {
        id: "P-NS-001",
        disruptionId: "D-NS-001",
        rank: 1,
        action: "Dispatch short-turn support buses via Nea Smyrni Square",
        passengerMinutesSaved: 3600,
        confidence: 82,
        rationale: "Adds tactical capacity at the local pressure point while protecting Syngrou Avenue transfer flows.",
        resources: ["3 reserve buses", "Square marshal team", "Signal priority request"],
        effects: {
          severityDelta: -0.22,
          durationDeltaMin: -12,
          intensityDelta: -0.18,
          loadRedistribution: { A2: -0.1, "106": -0.08, "126": -0.07 },
        },
      },
      {
        id: "P-NS-002",
        disruptionId: "D-NS-001",
        rank: 2,
        action: "Activate micromobility recovery zone",
        passengerMinutesSaved: 1900,
        confidence: 74,
        rationale: "Moves short local trips away from overloaded buses and improves last-mile recovery around the square.",
        resources: ["Micromobility geofence", "Operator incentive", "Wayfinding push"],
        effects: {
          severityDelta: -0.14,
          durationDeltaMin: -8,
          intensityDelta: -0.12,
          loadRedistribution: { A2: -0.05, "106": -0.04 },
        },
      },
    ],

    NETWORK_LINES: [
      {
        id: "A2",
        name: "A2 — Akadimia ↔ Voula",
        mode: "Bus",
        status: "warn",
        load: 78,
        frequency: "9 min",
        operator: "OASA",
      },
      {
        id: "106",
        name: "106 — Athens ↔ Agios Dimitrios / Nea Smyrni",
        mode: "Bus",
        status: "warn",
        load: 72,
        frequency: "12 min",
        operator: "OASA",
      },
      {
        id: "126",
        name: "126 — Syngrou-Fix ↔ Palaio Faliro",
        mode: "Bus",
        status: "ok",
        load: 58,
        frequency: "15 min",
        operator: "OASA",
      },
    ],

    MAP: {
      center: [23.7147, 37.9465],
      zoom: 14.25,

      locations: {
        "Nea Smyrni Square": [23.7147, 37.9465],
        "Syngrou — Nea Smyrni": [23.7177, 37.9512],
        "Alsos Neas Smyrnis": [23.7132, 37.9439],
      },

      lines: {
        A2: [
          [23.7067, 37.9389],
          [23.7147, 37.9465],
          [23.7177, 37.9512],
          [23.7281, 37.9643],
        ],
        "106": [
          [23.7048, 37.9482],
          [23.7147, 37.9465],
          [23.7240, 37.9495],
        ],
        "126": [
          [23.7108, 37.9414],
          [23.7147, 37.9465],
          [23.7208, 37.9542],
        ],
      },

      disruptionPaths: {
        "D-NS-001": [
          [23.7067, 37.9389],
          [23.7147, 37.9465],
          [23.7177, 37.9512],
        ],
      },

      transitShapes: {
        A2: [
          [23.7067, 37.9389],
          [23.7147, 37.9465],
          [23.7177, 37.9512],
          [23.7281, 37.9643],
        ],
        "106": [
          [23.7048, 37.9482],
          [23.7147, 37.9465],
          [23.7240, 37.9495],
        ],
        "126": [
          [23.7108, 37.9414],
          [23.7147, 37.9465],
          [23.7208, 37.9542],
        ],
      },

      transitStops: {
        "Nea Smyrni Square": [23.7147, 37.9465],
        "Syngrou Nea Smyrni": [23.7177, 37.9512],
        "Alsos Neas Smyrnis": [23.7132, 37.9439],
      },

      transitEndpoints: {
        "Nea Smyrni Square": [23.7147, 37.9465],
      },

      roadCorridors: {
        "Syngrou Avenue": [
          [23.7177, 37.9512],
          [23.7281, 37.9643],
        ],
      },
    },
  },

  thessaloniki: {
    CITY_CONFIG: {
      id: "thessaloniki",
      name: "Thessaloniki",
      operator: "OASTH",
    },

    DISRUPTIONS: [
      {
        id: "D-TH-001",
        mode: "Metro",
        line: "Metro",
        title: "Metro delay — central segment",
        location: "Dimokratias — Venizelou",
        severity: "high",
        affectedPax: 2200,
        status: "active",
        timestamp: "09:10",
        description: "Delay due to signalling adjustment.",
        timeline: [],
        startMinute: 9 * 60 + 10,
        endMinute: 10 * 60 + 5,
      },
    ],

    INTERVENTIONS: [
      {
        id: "P-TH-001",
        disruptionId: "D-TH-001",
        rank: 1,
        action: "Single-line metro turnback with platform metering",
        passengerMinutesSaved: 5400,
        confidence: 81,
        rationale: "Operate short turnbacks through the affected central segment and meter platform access to reduce dwell and queue spillback.",
        resources: [
          "2 platform marshals",
          "Control-room turnback dispatch",
          "PA announcements at Dimokratias and Venizelou"
        ],
        effects: {
          severityDelta: -0.3,
          durationDeltaMin: -10,
          intensityDelta: -0.2,
          loadRedistribution: { METRO: -0.12, BX1: 0.05 }
        }
      },
      {
        id: "P-TH-002",
        disruptionId: "D-TH-001",
        rank: 2,
        action: "Parallel bus bridge through central corridor",
        passengerMinutesSaved: 3200,
        confidence: 73,
        rationale: "Deploy limited-stop buses between Dimokratias and Venizelou to absorb central segment demand while signalling adjustment continues.",
        resources: [
          "3 replacement buses",
          "Surface stop marshals",
          "Passenger wayfinding staff"
        ],
        effects: {
          severityDelta: -0.18,
          durationDeltaMin: -6,
          intensityDelta: -0.12,
          loadRedistribution: { METRO: -0.08, BX1: 0.05 }
        }
      }
    ],
    NETWORK_LINES: [
      {
        id: "METRO",
        name: "Thessaloniki Metro",
        mode: "Metro",
        status: "warn",
        load: 78,
        frequency: "4 min",
        operator: "OASTH"
      },
      {
        id: "BX1",
        name: "X1 — Airport ↔ City Centre",
        mode: "Bus",
        status: "ok",
        load: 46,
        frequency: "20 min",
        operator: "OASTH"
      }
    ],

    MAP: {
      center: [22.9444, 40.6401],
      zoom: 12.2,

      locations: {
        "Dimokratias — Venizelou": [22.9385, 40.6396],
      },

      lines: {
        METRO: [
          [22.9298, 40.6402],
          [22.9385, 40.6399],
          [22.9468, 40.6391],
          [22.9574, 40.6382],
        ],
      },

      disruptionPaths: THESSALONIKI_DISRUPTION_PATHS,
      transitShapes: THESSALONIKI_TRANSIT_SHAPES,
      roadCorridors: THESSALONIKI_ROAD_CORRIDORS,
    },
  },
};

let currentCity = "athens";
let listeners = [];

export function getCityScenario(city = currentCity) {
  return CITY_DATA[city] ?? CITY_DATA.athens;
}

export function getCityData() {
  const base = getCityScenario(currentCity);
  const { currentMinute } = getTimelineState();

  const filtered = base.DISRUPTIONS.filter((d) => {
    if (d.startMinute == null || d.endMinute == null) return true;
    return currentMinute >= d.startMinute && currentMinute <= d.endMinute;
  });

  return {
    ...base,
    DISRUPTIONS: filtered,
  };
}

export function setCity(city) {
  currentCity = city;
  listeners.forEach((l) => l());
}

export function subscribeCity(cb) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
