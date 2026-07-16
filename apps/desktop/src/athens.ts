export const CITY = {
  name: "Athens",
  country: "Greece",
  timezone: "Europe/Athens",
  locale: "el-GR",
  currency: "EUR",
  operator: "OASA", // Οργανισμός Αστικών Συγκοινωνιών Αθηνών
};

export type Severity = "critical" | "high" | "medium" | "low";
export type TransportMode = "metro" | "tram" | "bus" | "taxi" | "micromobility";
export type DisruptionStatus = "active" | "monitoring" | "resolving" | "resolved";
export type InterventionStatus = "pending" | "accepted" | "rejected";

// ── Metro lines ───────────────────────────────────────────────────────────────
export const METRO_LINES = [
  { id: "M1", name: "Line 1 — Kifissia ↔ Piraeus",       color: "#009944", mode: "metro" as TransportMode },
  { id: "M2", name: "Line 2 — Anthoupoli ↔ Elliniko",    color: "#e30613", mode: "metro" as TransportMode },
  { id: "M3", name: "Line 3 — Nikaia ↔ Airport",         color: "#0070c0", mode: "metro" as TransportMode },
];

// ── Tram ──────────────────────────────────────────────────────────────────────
export const TRAM_LINES = [
  { id: "T4", name: "Tram 4 — Syntagma ↔ Voula",         color: "#ff6600", mode: "tram" as TransportMode },
  { id: "T5", name: "Tram 5 — SEF ↔ Faliro",             color: "#ff6600", mode: "tram" as TransportMode },
];

// ── Key bus corridors ─────────────────────────────────────────────────────────
export const BUS_LINES = [
  { id: "B040", name: "040 — Piraeus ↔ Syntagma (Trolley)",  color: "#8b5cf6", mode: "bus" as TransportMode },
  { id: "B224", name: "224 — Kifissia ↔ Chalandri",          color: "#8b5cf6", mode: "bus" as TransportMode },
  { id: "B608", name: "608 — Dafni ↔ Ano Liosia",            color: "#8b5cf6", mode: "bus" as TransportMode },
  { id: "BX95", name: "X95 — Airport ↔ Syntagma (Express)",  color: "#8b5cf6", mode: "bus" as TransportMode },
];

// ── Micromobility operators ───────────────────────────────────────────────────
export const MICROMOBILITY_OPERATORS = [
  { id: "MM_LIME",  name: "Lime",   type: "e-scooter", mode: "micromobility" as TransportMode },
  { id: "MM_BOLT",  name: "Bolt",   type: "e-scooter", mode: "micromobility" as TransportMode },
  { id: "MM_HOP",name: "HOP", type: "e-bike", mode: "micromobility" as TransportMode },
];

// ── Taxi / ride-hailing ───────────────────────────────────────────────────────
export const TAXI_OPERATORS = [
  { id: "TX_BEAT",  name: "Beat",   mode: "taxi" as TransportMode },
  { id: "TX_TAXIBEAT", name: "Taxiplon", mode: "taxi" as TransportMode },
];

// ── Key stations & areas ──────────────────────────────────────────────────────
export const STATIONS = [
  "Syntagma", "Monastiraki", "Omonia", "Thissio", "Acropoli",
  "Evangelismos", "Megaro Moussikis", "Katehaki", "Nomismatokopio",
  "Agia Paraskevi", "Doukissis Plakentias", "Athens Airport (ΑΙΑ)",
  "Piraeus", "Faliro", "Voula", "Glyfada", "Kifissia", "Halandri",
  "Anthoupoli", "Nikaia", "Dafni", "Elliniko",
  "Sepolia", "Attiki", "Viktoria", "Larissa Station",
];

// ── Disruptions ───────────────────────────────────────────────────────────────
export interface Disruption {
  id: string;
  lineId: string;
  lineName: string;
  mode: TransportMode;
  title: string;
  location: string;
  cause: string;
  severity: Severity;
  status: DisruptionStatus;
  affectedPax: number;
  startedAt: string;
  estimatedResolution: string | null;
}

export const DISRUPTIONS: Disruption[] = [
  {
    id: "D-ATH-001",
    lineId: "M1",
    lineName: "Line 1",
    mode: "metro",
    title: "Signal failure between Monastiraki and Thissio",
    location: "Monastiraki — Thissio segment",
    cause: "Track signal fault — junction box malfunction",
    severity: "critical",
    status: "active",
    affectedPax: 8400,
    startedAt: "08:14",
    estimatedResolution: "09:30",
  },
  {
    id: "D-ATH-002",
    lineId: "T4",
    lineName: "Tram 4",
    mode: "tram",
    title: "Tram blocked at Faliro coastal junction",
    location: "Faliro — SEF interchange",
    cause: "Road vehicle incursion on tram lane",
    severity: "high",
    status: "active",
    affectedPax: 1900,
    startedAt: "08:47",
    estimatedResolution: "09:15",
  },
  {
    id: "D-ATH-003",
    lineId: "B040",
    lineName: "040 Trolley",
    mode: "bus",
    title: "Trolley wire fault near Omonia",
    location: "Omonia Square — Stadiou St",
    cause: "Overhead wire disconnection",
    severity: "high",
    status: "active",
    affectedPax: 2100,
    startedAt: "09:02",
    estimatedResolution: "10:00",
  },
  {
    id: "D-ATH-004",
    lineId: "M3",
    lineName: "Line 3",
    mode: "metro",
    title: "Overcrowding — Syntagma platform",
    location: "Syntagma station",
    cause: "Protest march — Vassilissis Sofias Ave closed",
    severity: "medium",
    status: "monitoring",
    affectedPax: 3200,
    startedAt: "09:20",
    estimatedResolution: null,
  },
  {
    id: "D-ATH-005",
    lineId: "BX95",
    lineName: "X95 Express",
    mode: "bus",
    title: "Severe delay — Attiki Odos congestion",
    location: "Attiki Odos — Pallini interchange",
    cause: "Multi-vehicle collision — motorway reduced to 1 lane",
    severity: "high",
    status: "active",
    affectedPax: 950,
    startedAt: "08:55",
    estimatedResolution: "10:30",
  },
  {
    id: "D-ATH-006",
    lineId: "MM_LIME",
    lineName: "Lime",
    mode: "micromobility",
    title: "Fleet unavailable — Kolonaki zone",
    location: "Kolonaki — Dexameni area",
    cause: "Geofencing enforcement update blocking activation",
    severity: "low",
    status: "monitoring",
    affectedPax: 140,
    startedAt: "09:10",
    estimatedResolution: "09:45",
  },
];

// ── Interventions ─────────────────────────────────────────────────────────────
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

export const INTERVENTIONS: Intervention[] = [
  // D-ATH-001 — M1 signal failure
  {
    id: "P-ATH-001",
    disruptionId: "D-ATH-001",
    rank: 1,
    action: "Deploy replacement buses — Monastiraki ↔ Thissio",
    passengerMinutesSaved: 31200,
    confidence: 89,
    rationale:
      "Run shuttle buses along Apostolou Pavlou St and Ermou St between Monastiraki and Thissio. Three OASA diesel buses from Sepolia depot are available. Estimated travel-time overhead: +6 min vs metro. Covers ~90% of affected demand.",
    resources: ["3× OASA bus from Sepolia depot", "Traffic management at Monastiraki Sq", "PA announcements at Thissio and Monastiraki"],
  },
  {
    id: "P-ATH-002",
    disruptionId: "D-ATH-001",
    rank: 2,
    action: "Short-turn Line 1 at Attiki — extend M2 interchange",
    passengerMinutesSaved: 18700,
    confidence: 74,
    rationale:
      "Short-turn M1 northbound at Attiki. Passengers transfer to M2 at Attiki for onward travel toward Omonia. Reduces affected segment to Monastiraki–Thissio only. Interchange signage update required.",
    resources: ["Signage update at Attiki station", "Additional staff at Attiki interchange", "PA system — all M1 stations"],
  },
  {
    id: "P-ATH-003",
    disruptionId: "D-ATH-001",
    rank: 3,
    action: "Activate Beat ride-hailing surge pool — Thissio corridor",
    passengerMinutesSaved: 6400,
    confidence: 61,
    rationale:
      "Coordinate with Beat to prioritise Thissio–Monastiraki corridor via app dispatch. Supplements bus bridge for passengers unwilling to wait. Dependent on driver availability — confidence limited by real-time supply uncertainty.",
    resources: ["Beat API dispatch coordination", "Push notification to Beat app users in zone"],
  },

  // D-ATH-002 — Tram blocked Faliro
  {
    id: "P-ATH-004",
    disruptionId: "D-ATH-002",
    rank: 1,
    action: "Hold trams at Voula and SEF — await lane clearance",
    passengerMinutesSaved: 4800,
    confidence: 92,
    rationale:
      "Hold T4 trams at Voula (south) and SEF (north) termini until junction is cleared by traffic police. Obstruction vehicle removal estimated at 15–20 min. Holding prevents bunching and preserves timetable on resumption.",
    resources: ["Traffic police coordination — Faliro junction", "T4 driver hold instructions via radio"],
  },
  {
    id: "P-ATH-005",
    disruptionId: "D-ATH-002",
    rank: 2,
    action: "Divert affected passengers to Bolt e-scooters — coastal path",
    passengerMinutesSaved: 1900,
    confidence: 55,
    rationale:
      "Issue free-ride codes for Bolt e-scooters along the Faliro coastal path for passengers between Faliro and SEF. Suitable for able-bodied passengers. Distance ~1.8 km, avg transit time 7 min on segregated path.",
    resources: ["Bolt operator coordination — free-ride voucher batch", "Station staff at Faliro to direct passengers"],
  },

  // D-ATH-003 — Trolley wire fault Omonia
  {
    id: "P-ATH-006",
    disruptionId: "D-ATH-003",
    rank: 1,
    action: "Reroute 040 trolley via Panepistimiou — battery mode",
    passengerMinutesSaved: 9800,
    confidence: 83,
    rationale:
      "Switch affected 040 trolleys to onboard battery traction and reroute via Panepistimiou St, bypassing the fault zone at Omonia–Stadiou. Battery range is sufficient for the 2.3 km detour. Adds ~4 min per trip.",
    resources: ["040 driver instruction — battery mode activation", "Temporary stop relocation at Panepistimiou/Voukourestiou"],
  },
  {
    id: "P-ATH-007",
    disruptionId: "D-ATH-003",
    rank: 2,
    action: "Deploy diesel standby bus — Omonia ↔ Syntagma gap",
    passengerMinutesSaved: 5300,
    confidence: 78,
    rationale:
      "Deploy 2 diesel standby buses on direct Omonia–Syntagma run to absorb 040 passengers stranded at Omonia. Covers the highest-demand segment while wire repair is underway.",
    resources: ["2× diesel standby bus from Pedion Areos depot", "Temporary bus stop — Omonia east side"],
  },

  // D-ATH-004 — Syntagma overcrowding
  {
    id: "P-ATH-008",
    disruptionId: "D-ATH-004",
    rank: 1,
    action: "Implement skip-stop service — bypass Syntagma (M2 & M3)",
    passengerMinutesSaved: 12100,
    confidence: 80,
    rationale:
      "Run express M2 and M3 services that skip Syntagma during peak protest window (09:20–11:00). Passengers for Syntagma directed to board at Evangelismos (M3) or Monastiraki (M2) with walking connection. Reduces platform dwell time by ~65%.",
    resources: ["Network control authorisation — skip-stop protocol", "PA at Evangelismos, Monastiraki, Syntagma (exit advisory)", "Police liaison — crowd management at station entries"],
  },
  {
    id: "P-ATH-009",
    disruptionId: "D-ATH-004",
    rank: 2,
    action: "Cap entry at Syntagma — metered access via gates",
    passengerMinutesSaved: 7400,
    confidence: 71,
    rationale:
      "Restrict entry to Syntagma station via gated metering (max 120 pax/min). Queuing forms on surface. Staff deployed at all 4 entrances. Reduces platform overcrowding risk while maintaining service frequency.",
    resources: ["8× station staff — gate management", "Crowd control barriers — Syntagma surface exits", "Real-time platform occupancy monitoring"],
  },

  // D-ATH-005 — X95 Attiki Odos delay
  {
    id: "P-ATH-010",
    disruptionId: "D-ATH-005",
    rank: 1,
    action: "Activate X96 sea route — Piraeus ↔ Airport ferry connection",
    passengerMinutesSaved: 8900,
    confidence: 66,
    rationale:
      "Reroute airport passengers via X96 express bus to Piraeus, then coordinate with Piraeus port authority for fast ferry to Heraklion connector — not standard but feasible for non-time-critical cargo pax. For time-critical: escalate to M3 from Doukissis Plakentias.",
    resources: ["X96 capacity increase — 2 additional buses", "M3 extended parking advisory at Doukissis Plakentias", "Coordination with Eleftherios Venizelos airport ops"],
  },
  {
    id: "P-ATH-011",
    disruptionId: "D-ATH-005",
    rank: 2,
    action: "Divert X95 via Mesogion Ave — estimated +18 min",
    passengerMinutesSaved: 5100,
    confidence: 77,
    rationale:
      "Reroute X95 off Attiki Odos via Mesogion Ave and Kifissias Ave. Longer route adds 18 min but avoids full motorway stoppage. Recommend passenger notification push via OASA app for airport-bound passengers.",
    resources: ["X95 driver instruction — Mesogion reroute", "OASA app push notification — airport route affected", "Dynamic signage update at Syntagma X95 stop"],
  },

  // D-ATH-006 — Lime fleet Kolonaki
  {
    id: "P-ATH-012",
    disruptionId: "D-ATH-006",
    rank: 1,
    action: "Redirect users to HOP bikes — Kolonaki stations",
    passengerMinutesSaved: 620,
    confidence: 85,
    rationale:
      "Kolonaki has 3 active HOP e-bike stations within 200m of affected Lime zone. Issue in-app redirect advisory to Lime users in the area. HOP confirms 22 available bikes across Dexameni, Lycabettus base, and Patriarchou Ioakim St stations.",
    resources: ["HOP — in-app advisory coordination", "Lime — push notification to affected users"],
  },
];

// ── Network line status (for NetworkPage) ─────────────────────────────────────
export interface NetworkLine {
  id: string;
  name: string;
  mode: TransportMode;
  status: "ok" | "warn" | "crit";
  load: number; // 0–100
  frequency: string;
  operator: string;
}

export const NETWORK_LINES: NetworkLine[] = [
  { id: "M1",      name: "Line 1 — Kifissia ↔ Piraeus",      mode: "metro",         status: "crit", load: 94, frequency: "4 min",  operator: "STASY" },
  { id: "M2",      name: "Line 2 — Anthoupoli ↔ Elliniko",   mode: "metro",         status: "warn", load: 81, frequency: "4 min",  operator: "STASY" },
  { id: "M3",      name: "Line 3 — Nikaia ↔ Airport",        mode: "metro",         status: "warn", load: 76, frequency: "6 min",  operator: "STASY" },
  { id: "T4",      name: "Tram 4 — Syntagma ↔ Voula",        mode: "tram",          status: "crit", load: 88, frequency: "8 min",  operator: "STASY" },
  { id: "T5",      name: "Tram 5 — SEF ↔ Faliro",            mode: "tram",          status: "warn", load: 62, frequency: "10 min", operator: "STASY" },
  { id: "B040",    name: "040 Trolley — Piraeus ↔ Syntagma", mode: "bus",           status: "crit", load: 91, frequency: "5 min",  operator: "OASA"  },
  { id: "B224",    name: "224 — Kifissia ↔ Chalandri",       mode: "bus",           status: "ok",   load: 55, frequency: "12 min", operator: "OASA"  },
  { id: "B608",    name: "608 — Dafni ↔ Ano Liosia",         mode: "bus",           status: "ok",   load: 48, frequency: "15 min", operator: "OASA"  },
  { id: "BX95",    name: "X95 — Airport ↔ Syntagma",         mode: "bus",           status: "warn", load: 79, frequency: "20 min", operator: "OASA"  },
  { id: "TX_BEAT", name: "Beat",                              mode: "taxi",          status: "ok",   load: 67, frequency: "On demand", operator: "Beat" },
  { id: "MM_LIME", name: "Lime e-scooters",                   mode: "micromobility", status: "warn", load: 40, frequency: "On demand", operator: "Lime" },
  { id: "MM_BOLT", name: "Bolt e-scooters",                   mode: "micromobility", status: "ok",   load: 38, frequency: "On demand", operator: "Bolt" },
  { id: "MM_HOP", name: "HOP e-bikes",           mode: "micromobility", status: "ok",   load: 52, frequency: "On demand", operator: "HOP" },
];

// ── Dashboard stats ───────────────────────────────────────────────────────────
export const DASHBOARD_STATS = [
  { label: "Active Disruptions",  value: "5",       sub: "across all modes",      status: "crit" as const },
  { label: "Pax Affected",        value: "16,690",   sub: "estimated now",         status: "warn" as const },
  { label: "Proposals Pending",   value: "8",       sub: "awaiting decision",     status: "info" as const },
  { label: "Pax·Min Saved Today", value: "94,200",   sub: "since shift start",     status: "ok"   as const },
];

// ── Current operator session ──────────────────────────────────────────────────
export const OPERATOR = {
  name: "Ν. Παπαδόπουλος",
  nameEn: "N. Papadopoulos",
  role: "Shift Controller",
  terminal: "ATH-OCC-04",
  shiftStart: "07:00",
  city: "Athens",
};