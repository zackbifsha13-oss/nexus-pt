import { getSimulationState, type SimulationState } from "../simulation/simulationEngine";
import { subscribeTimeline, getTimelineState } from "./timelineStore";
import { subscribeInterventions } from "./interventionStore";

type Listener = (state: SimulationState) => void;

let listeners = new Set<Listener>();
let currentCity = "athens";
let currentState = getSimulationState(currentCity, getTimelineState().currentMinute);

function recompute() {
  currentState = getSimulationState(currentCity, getTimelineState().currentMinute);
  listeners.forEach((listener) => listener(currentState));
}

subscribeTimeline(() => recompute());
subscribeInterventions(() => recompute());

export function setSimulationCity(cityKey: string) {
  currentCity = cityKey;
  recompute();
}

export function getSimulationSnapshot() {
  return currentState;
}

export function subscribeSimulation(listener: Listener) {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}
