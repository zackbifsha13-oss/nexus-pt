export type TrafficProbe = {
  id: string;
  cityId: string;
  lineId?: string;
  disruptionId?: string;
  from: [number, number];
  to: [number, number];
  weight?: number;
  label?: string;
};

export const TRAFFIC_PROBES: TrafficProbe[] = [
  {
    id: "ath-m1-monastiraki-thissio",
    cityId: "athens",
    lineId: "M1",
    disruptionId: "D-ATH-001",
    from: [23.7305, 37.9734],
    to: [23.7211, 37.9783],
    weight: 1.0,
    label: "Monastiraki ↔ Thissio corridor",
  },
  {
    id: "ath-faliro-t4",
    cityId: "athens",
    lineId: "T4",
    disruptionId: "D-ATH-002",
    from: [23.6704, 37.9446],
    to: [23.6658, 37.9429],
    weight: 0.9,
    label: "Faliro coastal junction",
  },
  {
    id: "ath-omonia-b040",
    cityId: "athens",
    lineId: "B040",
    disruptionId: "D-ATH-003",
    from: [23.7282, 37.9845],
    to: [23.7341, 37.9778],
    weight: 0.85,
    label: "Omonia ↔ Syntagma trolley corridor",
  },
  {
    id: "ath-syntagma-m3",
    cityId: "athens",
    lineId: "M3",
    disruptionId: "D-ATH-004",
    from: [23.7337, 37.9763],
    to: [23.7363, 37.9747],
    weight: 0.7,
    label: "Syntagma central station area",
  },
  {
    id: "ath-pallini-x95",
    cityId: "athens",
    lineId: "BX95",
    disruptionId: "D-ATH-005",
    from: [23.8650, 38.0083],
    to: [23.8836, 38.0039],
    weight: 1.0,
    label: "Attiki Odos Pallini interchange",
  },
  {
    id: "ath-kifissia-b224",
    cityId: "athens",
    lineId: "B224",
    disruptionId: "D-ATH-006",
    from: [23.8048, 38.0727],
    to: [23.8100, 38.0747],
    weight: 0.55,
    label: "Kifissia local corridor",
  },
  {
    id: "ath-kolonaki-micro",
    cityId: "athens",
    lineId: "MM_LIME",
    disruptionId: "D-ATH-007",
    from: [23.7417, 37.9806],
    to: [23.7444, 37.9822],
    weight: 0.35,
    label: "Kolonaki micromobility zone",
  },
  {
    id: "th-metro-central",
    cityId: "thessaloniki",
    lineId: "METRO",
    disruptionId: "D-TH-001",
    from: [22.9334, 40.6400],
    to: [22.9450, 40.6391],
    weight: 1.0,
    label: "Dimokratias ↔ Venizelou corridor",
  },
  {
    id: "th-bx1-city-link",
    cityId: "thessaloniki",
    lineId: "BX1",
    from: [22.9385, 40.6396],
    to: [22.9574, 40.6382],
    weight: 0.45,
    label: "City centre bus fallback",
  }
];
