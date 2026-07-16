import type { Page } from "../App";
import { OPERATOR } from "../data/athens";

interface NavItem {
  id: Page;
  label: string;
}

const NAV: NavItem[] = [
  { id: "dashboard",     label: "Dashboard"    },
  { id: "network",       label: "Network"       },
  { id: "disruptions",   label: "Disruptions"   },
  { id: "interventions", label: "Interventions" },
  { id: "audit-log",     label: "Audit Log"     },
  { id: "settings",      label: "Settings"      },
];

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <aside className="flex flex-col w-48 shrink-0 bg-panel border-r border-border">
      <div className="h-12 flex items-center gap-2.5 px-4 border-b border-border">
        <div className="w-6 h-6 rounded bg-accent flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-black leading-none">Ο</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text leading-tight">OASA Console</p>
          <p className="text-2xs text-dim leading-tight">Athens OCC</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={[
                "w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-left transition-colors",
                active
                  ? "bg-muted text-text"
                  : "text-sub hover:bg-border hover:text-text",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-accent" : "bg-muted"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-text font-medium">{OPERATOR.nameEn}</p>
        <p className="text-xs text-dim">{OPERATOR.role}</p>
        <p className="text-xs text-dim">{OPERATOR.terminal} · from {OPERATOR.shiftStart}</p>
      </div>
    </aside>
  );
}