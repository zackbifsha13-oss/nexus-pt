export type MicromobilityOperator = "hop" | "dott" | "lime";

export type MicromobilityVehicle = {
  id: string;
  operator: MicromobilityOperator;
  lng: number;
  lat: number;
  battery: number;
  available: boolean;
};

// Back-compat alias — older code may still import HopVehicle.
export type HopVehicle = MicromobilityVehicle;

let vehicles: MicromobilityVehicle[] = [];

function jitter(value: number, spread = 0.012) {
  return value + (Math.random() - 0.5) * spread;
}

export function generateHopMockOnce(cityId = "athens") {
  const centers =
    cityId === "thessaloniki"
      ? [
          [22.9444, 40.6401],
          [22.9344, 40.6388],
          [22.9525, 40.6368],
        ]
      : [
          [23.7339, 37.9758],
          [23.7204, 37.9783],
          [23.7417, 37.9806],
          [23.6986, 37.9564],
          [23.7282, 37.9845],
        ];

  const baseCount = cityId === "thessaloniki" ? 35 : 60;

  // Mock fleets per operator. Different sizes so they look distinct on the map.
  const operatorPlan: Array<{ operator: MicromobilityOperator; count: number; prefix: string }> = [
    { operator: "hop",  count: baseCount,                    prefix: "HOP"  },
    { operator: "dott", count: Math.round(baseCount * 0.7),  prefix: "DOTT" },
    { operator: "lime", count: Math.round(baseCount * 0.85), prefix: "LIME" },
  ];

  vehicles = operatorPlan.flatMap(({ operator, count, prefix }) =>
    Array.from({ length: count }, (_, i) => {
      const c = centers[i % centers.length];
      return {
        id: `${prefix}-${cityId.toUpperCase()}-${i + 1}`,
        operator,
        lng: jitter(c[0]),
        lat: jitter(c[1]),
        battery: Math.round(25 + Math.random() * 75),
        available: Math.random() > 0.18,
      };
    })
  );

  return vehicles;
}

export function getMicromobilityVehicles(cityId = "athens") {
  if (vehicles.length === 0) {
    generateHopMockOnce(cityId);
  }
  return vehicles;
}

export function getHopVehicles(cityId = "athens") {
  // HOP-only — keep scoreHopAvailability and other HOP-specific scoring correct.
  return getMicromobilityVehicles(cityId).filter((v) => v.operator === "hop");
}

export function resetHopMock(cityId = "athens") {
  vehicles = [];
  return generateHopMockOnce(cityId);
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function distanceMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function scoreHopAvailability(
  cityId: string,
  center: [number, number] | null | undefined,
  radiusMeters = 500
) {
  if (!center) {
    return {
      vehiclesNearby: 0,
      availableNearby: 0,
      avgBattery: 0,
      score: 0,
      confidenceBoost: -10,
      label: "No HOP coverage",
    };
  }

  const nearby = getHopVehicles(cityId).filter((v) =>
    distanceMeters(center, [v.lng, v.lat]) <= radiusMeters
  );

  const available = nearby.filter((v) => v.available);
  const avgBattery =
    available.length > 0
      ? Math.round(
          available.reduce((sum, v) => sum + v.battery, 0) / available.length
        )
      : 0;

  const densityScore = Math.min(1, available.length / 18);
  const batteryScore = Math.min(1, avgBattery / 80);
  const score = Math.round((densityScore * 0.72 + batteryScore * 0.28) * 100);

  let label = "Low HOP availability";
  let confidenceBoost = -10;

  if (score >= 75) {
    label = "Strong HOP availability";
    confidenceBoost = 15;
  } else if (score >= 45) {
    label = "Moderate HOP availability";
    confidenceBoost = 5;
  }

  return {
    vehiclesNearby: nearby.length,
    availableNearby: available.length,
    avgBattery,
    score,
    confidenceBoost,
    label,
  };
}
