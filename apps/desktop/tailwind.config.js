/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f1117",
        panel:   "#161b26",
        raised:  "#1c2333",
        muted:   "#252e3f",
        border:  "#2a3347",
        dim:     "#64748b",
        sub:     "#94a3b8",
        text:    "#e2e8f0",
        accent:  "#f59e0b",
        ok:      "#10b981",
        warn:    "#f59e0b",
        crit:    "#ef4444",
        info:    "#3b82f6",
      },
    },
  },
  plugins: [],
};
