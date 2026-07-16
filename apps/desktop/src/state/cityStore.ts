export type CityId = "athens" | "thessaloniki" | "rethymno" | "barcelona";

let currentCity: CityId = "athens";
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeCity(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getCurrentCity(): CityId {
  return currentCity;
}

export function setCurrentCity(city: CityId) {
  currentCity = city;
  notify();
}
