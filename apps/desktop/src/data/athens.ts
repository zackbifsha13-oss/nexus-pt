export interface Disruption {
  id: string;
  line: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedPax: number;
}

export interface Intervention {
  id: string;
  disruptionId: string;
  rank: number;
  action: string;
  passengerMinutesSaved: number;
  confidence: number;
  rationale: string;
}

export const DISRUPTIONS: Disruption[] = [
  {
    id: "ATH-001",
    line: "M2",
    title: "Signal failure near Syntagma",
    severity: "critical",
    affectedPax: 8200,
  },
  {
    id: "ATH-002",
    line: "T6",
    title: "Tram obstruction toward Glyfada",
    severity: "high",
    affectedPax: 2100,
  },
  {
    id: "ATH-003",
    line: "B550",
    title: "Bus congestion on Kifisias corridor",
    severity: "medium",
    affectedPax: 1450,
  },
  {
    id: "ATH-004",
    line: "TAXI",
    title: "Ride-hailing shortage in central Athens",
    severity: "medium",
    affectedPax: 680,
  },
  {
    id: "ATH-005",
    line: "MM-OPS",
    title: "Micromobility imbalance in Koukaki–Syntagma cluster",
    severity: "low",
    affectedPax: 340,
  },
];

export const INTERVENTIONS: Intervention[] = [
  {
    id: "INT-001",
    disruptionId: "ATH-001",
    rank: 1,
    action: "Activate express bus bridge Syntagma–Akropoli–Neos Kosmos",
    passengerMinutesSaved: 31200,
    confidence: 92,
    rationale:
      "Deploying a temporary bus bridge on the disrupted M2 section absorbs central Athens passenger demand and protects onward interchange flows at Syntagma and Neos Kosmos.",
  },
  {
    id: "INT-002",
    disruptionId: "ATH-001",
    rank: 2,
    action: "Increase feeder bus frequency on Syngrou corridor",
    passengerMinutesSaved: 18800,
    confidence: 81,
    rationale:
      "Supplementing bus capacity along Syngrou Avenue reduces crowding pressure from diverted metro passengers and preserves access to central Athens destinations.",
  },
  {
    id: "INT-003",
    disruptionId: "ATH-001",
    rank: 3,
    action: "Push rebalancing request to taxi and ride-hailing partners at Syntagma",
    passengerMinutesSaved: 9400,
    confidence: 67,
    rationale:
      "Temporary ride-hailing and taxi concentration at Syntagma helps absorb urgent demand, though benefit is lower than fixed-route replacement capacity.",
  },
  {
    id: "INT-004",
    disruptionId: "ATH-002",
    rank: 1,
    action: "Short-turn tram services before blocked segment and add bus replacement to Glyfada",
    passengerMinutesSaved: 7600,
    confidence: 87,
    rationale:
      "Short-turning tram service preserves frequency on the unaffected section while replacement buses maintain coastal access toward Glyfada.",
  },
  {
    id: "INT-005",
    disruptionId: "ATH-002",
    rank: 2,
    action: "Redirect passengers to bus routes on Poseidonos corridor",
    passengerMinutesSaved: 4200,
    confidence: 73,
    rationale:
      "Existing bus services on the coastal corridor can absorb part of tram demand with lower setup time but higher travel-time variability.",
  },
  {
    id: "INT-006",
    disruptionId: "ATH-003",
    rank: 1,
    action: "Temporarily increase dispatch on parallel express bus services",
    passengerMinutesSaved: 3900,
    confidence: 84,
    rationale:
      "Extra dispatch on the Kifisias axis reduces headway gaps and limits knock-on delays during the congestion peak.",
  },
  {
    id: "INT-007",
    disruptionId: "ATH-003",
    rank: 2,
    action: "Recommend metro diversion for long-distance northbound trips",
    passengerMinutesSaved: 2500,
    confidence: 71,
    rationale:
      "Passenger messaging that shifts longer trips from bus to metro reduces corridor overload and improves reliability for remaining bus demand.",
  },
  {
    id: "INT-008",
    disruptionId: "ATH-004",
    rank: 1,
    action: "Trigger central zone driver incentive for taxi and ride-hailing supply",
    passengerMinutesSaved: 1800,
    confidence: 78,
    rationale:
      "A short-term incentive improves vehicle availability in central Athens and reduces wait times during supply shortage periods.",
  },
  {
    id: "INT-009",
    disruptionId: "ATH-005",
    rank: 1,
    action: "Request rebalancing from all three micromobility operators in Koukaki, Syntagma and Acropolis stations",
    passengerMinutesSaved: 950,
    confidence: 89,
    rationale:
      "Rebalancing scooters and bikes near tourist and interchange zones restores first/last-mile availability with minimal operational delay.",
  },
];
