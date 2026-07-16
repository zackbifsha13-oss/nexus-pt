import type { InterventionEffect } from "./simulationTypes";

export type Mode     = "Metro" | "Tram" | "Bus" | "Taxi" | "Micromobility";
export type Severity = "critical" | "high" | "medium" | "low";
export type DisruptionStatus   = "active" | "stabilizing" | "resolved";
export type InterventionStatus = "pending" | "accepted" | "rejected";
export type LineStatus         = "ok" | "warn" | "crit";

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

export interface InterventionEffect {
  severityDelta?: number;
  durationDeltaMin?: number;
  resolveAtAcceptance?: boolean;
  intensityDelta?: number;
  radiusDelta?: number;
  loadRedistribution?: Record<string, number>;
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
  effects?: InterventionEffect;
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
  id:       "athens",
  name:     "Athens",
  country:  "Greece",
  operator: "OASA",
  center:   "Athens Operations Control Centre",
  terminal: "ATH-OCC-04",
};

export const DISRUPTIONS: Disruption[] = [
  {
    id: "D-ATH-001",
    mode: "Metro",
    line: "M1 — Kifissia ↔ Piraeus",
    title: "Signal failure between Monastiraki and Thissio",
    location: "Monastiraki — Thissio",
    severity: "critical",
    affectedPax: 8400,
    status: "active",
    timestamp: "08:14",
    description:
      "A junction signal box malfunction between Monastiraki and Thissio stations has halted M1 services on this segment. Trains are holding at adjacent stations. Engineering teams have been dispatched and estimate a 60–75 minute repair window.",
    timeline: [
      { time: "08:14", text: "Signal fault detected — automatic stop triggered" },
      { time: "08:17", text: "OCC alerted — incident opened" },
      { time: "08:22", text: "Engineering team dispatched from Sepolia depot" },
      { time: "08:31", text: "Trains holding at Monastiraki and Thissio platforms" },
      { time: "08:45", text: "PA announcements active across M1 corridor" },
    ],
  },
  {
    id: "D-ATH-002",
    mode: "Tram",
    line: "T4 — Syntagma ↔ Voula",
    title: "Tram blocked at Faliro coastal junction",
    location: "Faliro — SEF interchange",
    severity: "high",
    affectedPax: 1900,
    status: "active",
    timestamp: "08:47",
    description:
      "A private vehicle has entered the tram lane at the Faliro coastal junction, blocking T4 services between SEF and Voula. Traffic police have been contacted. Clearance is expected within 20–30 minutes.",
    timeline: [
      { time: "08:47", text: "Obstruction reported by T4 driver — Faliro junction" },
      { time: "08:49", text: "Traffic police notified" },
      { time: "08:52", text: "T4 services halted south of SEF" },
      { time: "09:01", text: "Police on scene — vehicle removal in progress" },
    ],
  },
  {
    id: "D-ATH-003",
    mode: "Bus",
    line: "040 Trolley — Piraeus ↔ Syntagma",
    title: "Overhead wire disconnection near Omonia Square",
    location: "Omonia — Stadiou St",
    severity: "high",
    affectedPax: 2100,
    status: "active",
    timestamp: "09:02",
    description:
      "An overhead trolley wire has become disconnected on Stadiou Street near Omonia Square, disabling electric traction for route 040. Affected trolleys have switched to battery mode but battery range is insufficient for the full route.",
    timeline: [
      { time: "09:02", text: "Wire disconnection reported — 040 driver" },
      { time: "09:05", text: "Trolleys switched to battery mode" },
      { time: "09:08", text: "OCC requests diesel standby from Pedion Areos depot" },
      { time: "09:15", text: "2 diesel buses confirmed en route" },
      { time: "09:20", text: "Reroute via Panepistimiou authorised" },
    ],
  },
  {
    id: "D-ATH-004",
    mode: "Metro",
    line: "M3 — Nikaia ↔ Airport",
    title: "Platform overcrowding at Syntagma — protest march impact",
    location: "Syntagma station",
    severity: "medium",
    affectedPax: 3200,
    status: "stabilizing",
    timestamp: "09:20",
    description:
      "A protest march along Vassilissis Sofias Avenue has caused significant passenger overflow into Syntagma Metro station. Entry metering has been activated. M3 skip-stop service is running to reduce dwell time.",
    timeline: [
      { time: "09:20", text: "Crowd surge detected at Syntagma entries" },
      { time: "09:24", text: "Entry metering activated — gates throttled" },
      { time: "09:28", text: "Skip-stop service authorised — Syntagma bypassed" },
      { time: "09:35", text: "8 staff deployed to platform and surface gates" },
      { time: "09:44", text: "Situation stabilising — queue reducing" },
    ],
  },
  {
    id: "D-ATH-005",
    mode: "Bus",
    line: "X95 — Airport ↔ Syntagma",
    title: "Major delay — Attiki Odos multi-vehicle collision",
    location: "Attiki Odos — Pallini interchange",
    severity: "high",
    affectedPax: 950,
    status: "active",
    timestamp: "08:55",
    description:
      "A multi-vehicle collision on the Attiki Odos motorway near Pallini has reduced the carriageway to a single lane. X95 airport buses are experiencing 35–50 minute delays. Reroute via Mesogion Avenue has been approved.",
    timeline: [
      { time: "08:55", text: "Collision reported — Attiki Odos Pallini" },
      { time: "08:58", text: "X95 driver reports 25-minute standstill" },
      { time: "09:05", text: "OCC opens incident — airport ops notified" },
      { time: "09:12", text: "Mesogion reroute under evaluation" },
      { time: "09:20", text: "Reroute approved — driver instructions issued" },
    ],
  },
  {
    id: "D-ATH-006",
    mode: "Bus",
    line: "B224 — Kifissia ↔ Chalandri",
    title: "Bus breakdown blocking stop — Kifisias Avenue",
    location: "Kifissia — Plateia Platanon",
    severity: "low",
    affectedPax: 310,
    status: "stabilizing",
    timestamp: "09:33",
    description:
      "A B224 bus has broken down and is stationary at the Plateia Platanon stop on Kifisias Avenue. Recovery vehicle is en route. The following service has been held back to avoid bunching.",
    timeline: [
      { time: "09:33", text: "Bus breakdown reported — engine failure" },
      { time: "09:36", text: "Recovery vehicle dispatched" },
      { time: "09:38", text: "Following service held — anti-bunching measure" },
      { time: "09:45", text: "Traffic partially clearing around vehicle" },
    ],
  },
  {
    id: "D-ATH-007",
    mode: "Micromobility",
    line: "Lime — e-scooters",
    title: "Geofencing fault — fleet unavailable in Kolonaki zone",
    location: "Kolonaki — Dexameni",
    severity: "low",
    affectedPax: 140,
    status: "active",
    timestamp: "09:10",
    description:
      "A geofencing configuration update has incorrectly blocked Lime e-scooter activation in the Kolonaki–Dexameni zone. Approximately 38 scooters are physically available but cannot be unlocked. Lime technical team is rolling back the update.",
    timeline: [
      { time: "09:10", text: "User complaints reported — scooters not unlocking" },
      { time: "09:14", text: "Lime ops contacted — geofencing fault identified" },
      { time: "09:22", text: "Rollback initiated by Lime technical team" },
      { time: "09:30", text: "Partial restoration — 12 of 38 units active" },
    ],
  },
  {
    id: "D-ATH-008",
    mode: "Metro",
    line: "M2 — Anthoupoli ↔ Elliniko",
    title: "Service resumed — earlier power fluctuation cleared",
    location: "Dafni — Agios Ioannis segment",
    severity: "low",
    affectedPax: 680,
    status: "resolved",
    timestamp: "07:48",
    description:
      "A brief power fluctuation on the M2 southern segment caused a 12-minute service suspension. Power was restored and full service resumed at 08:03. Incident is now closed.",
    timeline: [
      { time: "07:48", text: "Power fluctuation detected — auto-stop triggered" },
      { time: "07:51", text: "Substation isolated for inspection" },
      { time: "07:56", text: "Fault cleared — power restored" },
      { time: "08:03", text: "Full service resumed on M2 southern segment" },
      { time: "08:10", text: "Incident closed" },
    ],
  },
];

export const INTERVENTIONS: Intervention[] = [
  {
    id: "P-ATH-001",
    disruptionId: "D-ATH-001",
    rank: 1,
    action: "Deploy replacement buses — Monastiraki ↔ Thissio",
    passengerMinutesSaved: 31200,
    confidence: 89,
    rationale:
      "Run shuttle buses along Apostolou Pavlou St between Monastiraki and Thissio. Three OASA diesel buses from Sepolia depot are available immediately. Estimated travel-time overhead: +6 min vs metro. Covers ~90% of affected demand.",
    resources: [
      "3× OASA bus from Sepolia depot",
      "Traffic management at Monastiraki Sq",
      "PA announcements at Thissio and Monastiraki",
    ],
    effects: { severityDelta: -0.4, durationDeltaMin: -15, intensityDelta: -0.25, loadRedistribution: { M1: -0.12, B040: 0.08, TX_BEAT: 0.05 } },
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
    resources: [
      "Signage update at Attiki station",
      "Additional staff at Attiki interchange",
      "PA system — all M1 stations",
    ],
    effects: { severityDelta: -0.25, durationDeltaMin: -6, intensityDelta: -0.12, loadRedistribution: { M1: -0.08, M2: 0.06, M3: 0.03 } },
  },
  {
    id: "P-ATH-003",
    disruptionId: "D-ATH-001",
    rank: 3,
    action: "Activate Beat ride-hailing surge pool — Thissio corridor",
    passengerMinutesSaved: 6400,
    confidence: 61,
    rationale:
      "Coordinate with Beat to prioritise the Thissio–Monastiraki corridor via app dispatch. Supplements bus bridge for passengers unwilling to wait. Confidence limited by real-time driver supply uncertainty.",
    resources: [
      "Beat API dispatch coordination",
      "Push notification to Beat app users in zone",
    ],
  },
  {
    id: "P-ATH-004",
    disruptionId: "D-ATH-002",
    rank: 1,
    action: "Hold trams at Voula and SEF — await lane clearance",
    passengerMinutesSaved: 4800,
    confidence: 92,
    rationale:
      "Hold T4 trams at Voula (south) and SEF (north) termini until junction is cleared by traffic police. Estimated clearance 15–20 min. Holding prevents bunching and preserves timetable on resumption.",
    resources: [
      "Traffic police coordination — Faliro junction",
      "T4 driver hold instructions via radio",
    ],
    effects: { resolveAtAcceptance: true, intensityDelta: -0.5, loadRedistribution: { T4: -0.18, MM_BOLT: 0.06, MM_HOP: 0.03 } },
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
    resources: [
      "Bolt operator coordination — free-ride voucher batch",
      "Station staff at Faliro to direct passengers",
    ],
  },
  {
    id: "P-ATH-006",
    disruptionId: "D-ATH-003",
    rank: 1,
    action: "Reroute 040 via Panepistimiou — battery mode",
    passengerMinutesSaved: 9800,
    confidence: 83,
    rationale:
      "Switch affected 040 trolleys to onboard battery traction and reroute via Panepistimiou St, bypassing the fault zone at Omonia–Stadiou. Battery range is sufficient for the 2.3 km detour. Adds ~4 min per trip.",
    resources: [
      "040 driver instruction — battery mode activation",
      "Temporary stop relocation at Panepistimiou/Voukourestiou",
    ],
    effects: { severityDelta: -0.3, durationDeltaMin: -8, intensityDelta: -0.16, loadRedistribution: { B040: -0.10, B608: 0.04, BX95: 0.02 } },
  },
  {
    id: "P-ATH-007",
    disruptionId: "D-ATH-003",
    rank: 2,
    action: "Deploy diesel standby buses — Omonia ↔ Syntagma gap",
    passengerMinutesSaved: 5300,
    confidence: 78,
    rationale:
      "Deploy 2 diesel standby buses on direct Omonia–Syntagma run to absorb 040 passengers stranded at Omonia. Covers the highest-demand segment while wire repair is underway.",
    resources: [
      "2× diesel standby bus from Pedion Areos depot",
      "Temporary bus stop — Omonia east side",
    ],
    effects: { severityDelta: -0.18, durationDeltaMin: -5, intensityDelta: -0.10, loadRedistribution: { B040: -0.06, B608: 0.05 } },
  },
  {
    id: "P-ATH-008",
    disruptionId: "D-ATH-004",
    rank: 1,
    action: "Implement skip-stop service — bypass Syntagma (M2 & M3)",
    passengerMinutesSaved: 12100,
    confidence: 80,
    rationale:
      "Run express M2 and M3 services that skip Syntagma during peak protest window (09:20–11:00). Passengers for Syntagma directed to board at Evangelismos (M3) or Monastiraki (M2). Reduces platform dwell time by ~65%.",
    resources: [
      "Network control authorisation — skip-stop protocol",
      "PA at Evangelismos, Monastiraki, Syntagma (exit advisory)",
      "Police liaison — crowd management at station entries",
    ],
    effects: { severityDelta: -0.2, durationDeltaMin: -10, intensityDelta: -0.14, loadRedistribution: { M3: -0.08, M2: 0.05, TX_BEAT: 0.02 } },
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
    resources: [
      "8× station staff — gate management",
      "Crowd control barriers — Syntagma surface exits",
      "Real-time platform occupancy monitoring",
    ],
  },
  {
    id: "P-ATH-010",
    disruptionId: "D-ATH-005",
    rank: 1,
    action: "Divert X95 via Mesogion Ave — estimated +18 min",
    passengerMinutesSaved: 5100,
    confidence: 77,
    rationale:
      "Reroute X95 off Attiki Odos via Mesogion Ave and Kifissias Ave. Longer route adds 18 min but avoids the full motorway stoppage. Recommend passenger notification push via OASA app.",
    resources: [
      "X95 driver instruction — Mesogion reroute",
      "OASA app push notification — airport route affected",
      "Dynamic signage update at Syntagma X95 stop",
    ],
    effects: { severityDelta: -0.22, durationDeltaMin: -12, intensityDelta: -0.12, loadRedistribution: { BX95: -0.14, M3: 0.06, TX_BEAT: 0.03 } },
  },
  {
    id: "P-ATH-011",
    disruptionId: "D-ATH-005",
    rank: 2,
    action: "Advise M3 park-and-ride — Doukissis Plakentias",
    passengerMinutesSaved: 3800,
    confidence: 68,
    rationale:
      "Push advisory to airport-bound passengers to drive to Doukissis Plakentias station and take M3 direct to airport. Reduces X95 dependency. Parking capacity at station is 420 spaces, currently 55% full.",
    resources: [
      "OASA app push — airport travel advisory",
      "M3 frequency increase request — Doukissis ↔ Airport",
    ],
    effects: { severityDelta: -0.15, durationDeltaMin: -4, intensityDelta: -0.08, loadRedistribution: { BX95: -0.08, M3: 0.07 } },
  },
  {
    id: "P-ATH-012",
    disruptionId: "D-ATH-006",
    rank: 1,
    action: "Hold following B224 service — prevent bunching",
    passengerMinutesSaved: 1100,
    confidence: 94,
    rationale:
      "Hold the next B224 departure at Kifissia terminus for 8 minutes to create gap spacing. Once recovery vehicle clears the breakdown, release held service to restore even headway.",
    resources: [
      "B224 driver hold instruction via radio",
      "PA at Kifissia terminus — delay advisory",
    ],
  },
  {
    id: "P-ATH-013",
    disruptionId: "D-ATH-007",
    rank: 1,
    action: "Redirect users to HOP bikes — Kolonaki stations",
    passengerMinutesSaved: 620,
    confidence: 85,
    rationale:
      "Kolonaki has 3 active HOP e-bike stations within 200m of the affected Lime zone. Issue in-app redirect advisory. HOP confirms 22 available bikes across Dexameni, Lycabettus base, and Patriarchou Ioakim St.",
    resources: [
      "HOP — in-app advisory coordination",
      "Lime — push notification to affected users",
    ],
  },
];

export const NETWORK_LINES: NetworkLine[] = [
  { id: "M1",        name: "Line 1 — Kifissia ↔ Piraeus",       mode: "Metro",         status: "crit", load: 94, frequency: "4 min",     operator: "STASY" },
  { id: "M2",        name: "Line 2 — Anthoupoli ↔ Elliniko",    mode: "Metro",         status: "warn", load: 81, frequency: "4 min",     operator: "STASY" },
  { id: "M3",        name: "Line 3 — Nikaia ↔ Airport",         mode: "Metro",         status: "warn", load: 76, frequency: "6 min",     operator: "STASY" },
  { id: "T4",        name: "Tram 4 — Syntagma ↔ Voula",         mode: "Tram",          status: "crit", load: 88, frequency: "8 min",     operator: "STASY" },
  { id: "T5",        name: "Tram 5 — SEF ↔ Faliro",             mode: "Tram",          status: "warn", load: 62, frequency: "10 min",    operator: "STASY" },
  { id: "B040",      name: "040 Trolley — Piraeus ↔ Syntagma",  mode: "Bus",           status: "crit", load: 91, frequency: "5 min",     operator: "OASA" },
  { id: "B224",      name: "224 — Kifissia ↔ Chalandri",        mode: "Bus",           status: "warn", load: 58, frequency: "12 min",    operator: "OASA" },
  { id: "B608",      name: "608 — Dafni ↔ Ano Liosia",          mode: "Bus",           status: "ok",   load: 48, frequency: "15 min",    operator: "OASA" },
  { id: "BX95",      name: "X95 — Airport ↔ Syntagma",          mode: "Bus",           status: "warn", load: 79, frequency: "20 min",    operator: "OASA" },
  { id: "TX_BEAT",   name: "Beat",                               mode: "Taxi",          status: "ok",   load: 67, frequency: "On demand", operator: "Beat" },
  { id: "MM_LIME",   name: "Lime e-scooters",                    mode: "Micromobility", status: "warn", load: 40, frequency: "On demand", operator: "Lime" },
  { id: "MM_BOLT",   name: "Bolt e-scooters",                    mode: "Micromobility", status: "ok",   load: 38, frequency: "On demand", operator: "Bolt" },
  { id: "MM_HOP", name: "HOP e-bikes",            mode: "Micromobility", status: "ok",   load: 52, frequency: "On demand", operator: "HOP" },
];

export const DASHBOARD_STATS: DashboardStat[] = [
  { label: "Active Disruptions",  value: "6",      sub: "across all modes",   status: "crit" },
  { label: "Pax Affected",        value: "16,690", sub: "estimated now",      status: "warn" },
  { label: "Proposals Pending",   value: "9",      sub: "awaiting decision",  status: "info" },
  { label: "Pax·Min Saved Today", value: "94,200", sub: "since shift start",  status: "ok"   },
];

export const OPERATOR = {
  name:       "Ν. Παπαδόπουλος",
  nameEn:     "N. Papadopoulos",
  role:       "Shift Controller",
  terminal:   "ATH-OCC-04",
  shiftStart: "07:00",
};
