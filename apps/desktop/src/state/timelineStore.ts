let currentMinute = 8 * 60;
let isPlaying = false;
let listeners = [];
let timer = null;

function emit() {
  listeners.forEach((l) => l());
}

export function getTimelineState() {
  return { currentMinute, isPlaying };
}

export function formatMinute(minute) {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function setMinute(minute) {
  currentMinute = Math.max(0, Math.min(24 * 60 - 1, minute));
  emit();
}

export function stepForward(minutes = 1) {
  currentMinute = (currentMinute + minutes) % (24 * 60);
  emit();
}

export function stepBackward(minutes = 1) {
  currentMinute = (currentMinute - minutes + 24 * 60) % (24 * 60);
  emit();
}

export function play() {
  if (isPlaying) return;
  isPlaying = true;
  timer = window.setInterval(() => {
    currentMinute += 1;
    if (currentMinute >= 12 * 60) currentMinute = 8 * 60;
    emit();
  }, 1000);
  emit();
}

export function pause() {
  if (!isPlaying) return;
  isPlaying = false;
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  emit();
}

export function subscribeTimeline(cb) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
