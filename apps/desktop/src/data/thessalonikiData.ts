export type Mode     = "Metro" | "Tram" | "Bus" | "Taxi" | "Micromobility";
export type Severity = "critical" | "high" | "medium" | "low";
export type DisruptionStatus = "active" | "stabilizing" | "resolved";
export type LineStatus = "ok" | "warn" | "crit";

export interface TimelineEvent {
  time: string;
  text: string;
}

export interface Disruption {
  id: string;
  mode: Mode;
  line: string;
  title: string;
  location: string;
  severity: Severity;
  affectedPax: number;
  status: DisruptionStatus;
  timestamp: string;
  description: string;
  timeline: TimelineEvent[];
}

export interface Intervention {
  id: string;
  disruptionId: string;
  rank: number;
  action: string;
  passengerMinutesSaved: number;
  confidence: number;
  rationale: string;
  resources: string[];
}

export interface NetworkLine {
  id: string;
  name: string;
  mode: Mode;
  status: LineStatus;
  load: number;
  frequency: string;
  operator: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  sub: string;
  status: "ok" | "warn" | "crit" | "info";
}

export const CITY_CONFIG = {
  id: "thessaloniki",
  name: "Thessaloniki",
  country: "Greece",
  operator: "Thema OCC",
  center: "Thessaloniki Operations Control Centre",
  terminal: "SKG-OCC-02",
};

export const DISRUPTIONS: Disruption[] = [
  {
    id: "D-THES-001",
    mode: "Metro",
    line: "Metro Main Line",
    title: "Train hold near Dimokratias",
    location: "Dimokratias — Venizelou",
    severity: "high",
    affectedPax: 4200,
    status: "active",
    timestamp: "08:26",
    description:
      "A train has been held near Dimokratias due to signalling verification procedures, delaying central section services.",
    timeline: [
      { time: "08:26", text: "Train hold initiated by control" },
      { time: "08:31", text: "Signalling inspection in progress" },
      { time: "08:39", text: "Passenger announcements activated" }
    ],
  },
  {
    id: "D-THES-002",
    mode: "Bus",
    line: "X1 — Airport ↔ City Centre",
    title: "Heavy delay on Vasileos Georgiou corridor",
    location: "City Centre — Airport axis",
    severity: "medium",
    affectedPax: 1700,
    status: "active",
    timestamp: "09:05",
    description:
      "Heavy congestion on the airport corridor is delaying X1 services by 20–30 minutes.",
    timeline: [
      { time: "09:05", text: "Travel time threshold exceeded" },
      { time: "09:12", text: "Bus dispatch notified" },
      { time: "09:18", text: "Passenger advisory issued" }
    ],
  },
  {
    id: "D-THES-003",
    mode: "Micromobility",
    line: "Operator cluster — Waterfront",
    title: "Low scooter availability near waterfront",
    location: "White Tower — Nea Paralia",
    severity: "low",
    affectedPax: 220,
    status: "stabilizing",
    timestamp: "09:20",
    description:
      "Scooter demand exceeded forecast along the waterfront. Operators are rebalancing stock.",
    timeline: [
      { time: "09:20", text: "Low vehicle availability detected" },
      { time: "09:28", text: "Rebalancing requests sent" }
    ],
  },
];

export const INTERVENTIONS: Intervention[] = [
  {
    id: "P-THES-001",
    disruptionId: "D-THES-001",
    rank: 1,
    action: "Short-turn metro services outside central hold zone",
    passengerMinutesSaved: 11200,
    confidence: 84,
    rationale:
      "Short-turning services protects outer section reliability while signalling checks continue in the central segment.",
    resources: [
      "Control authorization",
      "Platform staff at interchange stations"
    ],
  },
  {
    id: "P-THES-002",
    disruptionId: "D-THES-002",
    rank: 1,
    action: "Increase dispatch on airport bus departures",
    passengerMinutesSaved: 4200,
    confidence: 77,
    rationale:
      "Adding dispatch frequency on the airport route reduces queueing and absorbs corridor delay effects.",
    resources: [
      "2 standby buses",
      "Driver overtime approval"
    ],
  },
  {
    id: "P-THES-003",
    disruptionId: "D-THES-003",
    rank: 1,
    action: "Request micromobility rebalancing on waterfront zone",
    passengerMinutesSaved: 600,
    confidence: 88,
    rationale:
      "Rebalancing scooters near the waterfront restores short-trip capacity quickly.",
    resources: [
      "Operator rebalance vans",
      "In-app rider advisory"
    ],
  },
];

export const NETWORK_LINES: NetworkLine[] = [
  { id: "M", name: "Metro Main Line", mode: "Metro", status: "warn", load: 78, frequency: "5 min", operator: "Thema Metro" },
  { id: "X1", name: "Airport ↔ City Centre", mode: "Bus", status: "warn", load: 82, frequency: "20 min", operator: "OASTH" },
  { id: "B5", name: "KTEL ↔ Centre", mode: "Bus", status: "ok", load: 54, frequency: "12 min", operator: "OASTH" },
  { id: "MM-WF", name: "Waterfront Micromobility", mode: "Micromobility", status: "warn", load: 41, frequency: "On demand", operator: "Shared Ops" }
];

export const DASHBOARD_STATS: DashboardStat[] = [
  { label: "Active Disruptions", value: "3", sub: "across all modes", status: "crit" },
  { label: "Pax Affected", value: "6,120", sub: "estimated now", status: "warn" },
  { label: "Proposals Pending", value: "3", sub: "awaiting decision", status: "info" },
  { label: "Pax·Min Saved Today", value: "18,400", sub: "since shift start", status: "ok" }
];

export const OPERATOR = {
  name: "Δ. Ιωαννίδης",
  nameEn: "D. Ioannidis",
  role: "Shift Controller",
  terminal: "SKG-OCC-02",
  shiftStart: "07:00",
};
