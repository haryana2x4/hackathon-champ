import {
  Bot,
  FileText,
  FolderGit2,
  Lightbulb,
  MapPin,
  Menu,
  Rocket,
  Timer,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import type { HealthResponse, PageId } from "../types";

interface NavItem {
  id: PageId;
  label: string;
  hint: string;
  requiresAi: boolean;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "brief", label: "Brief", hint: "Analyze rules & rubric", requiresAi: true, icon: FileText },
  { id: "ideas", label: "Ideas", hint: "Score & lock a concept", requiresAi: true, icon: Lightbulb },
  { id: "champ", label: "Champ", hint: "AI agent & Mission Control", requiresAi: true, icon: Bot },
  { id: "map", label: "Map", hint: "Track events & GeoJSON", requiresAi: false, icon: MapPin },
  { id: "sprint", label: "Sprint", hint: "Timeline & countdown", requiresAi: false, icon: Timer },
  { id: "submission", label: "Submission", hint: "Devpost kit & pitch", requiresAi: true, icon: Rocket },
  { id: "scaffold", label: "Scaffold", hint: "Generate starter repo", requiresAi: false, icon: FolderGit2 },
];

interface SidebarProps {
  activePage: PageId;
  onSelect: (page: PageId) => void;
  health: HealthResponse | null;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function Sidebar({
  activePage,
  onSelect,
  health,
  mobileOpen,
  onToggleMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-[#0E1525] border-r border-[#24324E]">
      <div className="px-5 py-5 border-b border-[#24324E] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22D3EE]" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight text-[#EEF4FC]">
              Hackathon Champ
            </span>
          </div>
          <p className="text-xs text-[#9EB0CC] mt-1 font-mono uppercase tracking-wider">
            Mission Control
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-lg text-[#CBD7EA] hover:bg-[#1A253D]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id);
                if (mobileOpen) onToggleMobile();
              }}
              aria-current={active ? "page" : undefined}
              className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                active
                  ? "bg-[#22D3EE]/15 text-[#EEF4FC] border border-[#22D3EE]/60"
                  : "text-[#C5D3E8] border border-transparent hover:bg-[#162036] hover:text-[#EEF4FC]"
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${active ? "text-[#22D3EE]" : "text-[#8CA2C4]"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-base leading-tight">{item.label}</span>
                  {item.requiresAi && health && !health.gemini_configured ? (
                    <span
                      title="Needs Gemini API key in .env"
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#1A253D] text-[#9EB0CC]"
                    >
                      Key
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[#9EB0CC] truncate mt-0.5">{item.hint}</p>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-[#24324E] text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[#9EB0CC]">Backend API</span>
          <span className="font-mono text-[#EEF4FC]">
            {health?.status === "ok" ? "ONLINE" : "CONNECTING"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#9EB0CC]">Gemini AI</span>
          <span
            className={`font-mono ${
              health?.gemini_configured ? "text-[#22D3EE]" : "text-[#CBD7EA]"
            }`}
          >
            {health ? (health.gemini_configured ? health.gemini_model : "NO KEY") : "..."}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0E1525] border-b border-[#24324E]">
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label="Open navigation menu"
          className="p-2 rounded-lg text-[#EEF4FC] hover:bg-[#1A253D]"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-[#EEF4FC] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22D3EE]" aria-hidden="true" />
          Hackathon Champ
        </span>
        <span className="w-10" aria-hidden="true" />
      </header>

      {/* Desktop fixed left rail */}
      <aside className="hidden lg:block w-72 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[85vw] h-full">{navContent}</div>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={onToggleMobile}
            className="flex-1 bg-black/60"
          />
        </div>
      ) : null}
    </>
  );
}
