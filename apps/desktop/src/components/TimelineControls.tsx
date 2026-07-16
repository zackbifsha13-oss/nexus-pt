import { useEffect, useState } from "react";
import {
  formatMinute,
  getTimelineState,
  pause,
  play,
  stepBackward,
  stepForward,
  subscribeTimeline,
} from "../state/timelineStore";

export default function TimelineControls() {
  const [state, setState] = useState(getTimelineState());

  useEffect(() => {
    const unsub = subscribeTimeline(() => {
      setState(getTimelineState());
    });
    return unsub;
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        border: "1px solid #2a3347",
        borderRadius: 10,
        background: "#161b26",
      }}
    >
      <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Timeline
      </span>

      <button
        onClick={() => stepBackward(5)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #2a3347",
          background: "transparent",
          color: "white",
          cursor: "pointer",
        }}
      >
        -5m
      </button>

      {!state.isPlaying ? (
        <button
          onClick={play}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "#10b981",
            color: "black",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Play
        </button>
      ) : (
        <button
          onClick={pause}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "#f59e0b",
            color: "black",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Pause
        </button>
      )}

      <button
        onClick={() => stepForward(5)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #2a3347",
          background: "transparent",
          color: "white",
          cursor: "pointer",
        }}
      >
        +5m
      </button>

      <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
        {formatMinute(state.currentMinute)}
      </span>
    </div>
  );
}
