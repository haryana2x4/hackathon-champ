import { useEffect, useState } from "react";
import { api } from "./api";
import { KeyMissingBanner } from "./components/KeyMissingBanner";
import { Sidebar, NAV_ITEMS } from "./components/Sidebar";
import { ErrorBanner } from "./components/PageState";
import { MapPage } from "./pages/MapPage";
import { SprintPage } from "./pages/SprintPage";
import { ScaffoldPage } from "./pages/ScaffoldPage";
import type { HealthResponse, PageId } from "./types";

function getInitialPage(): PageId {
  const hash = window.location.hash.replace("#", "") as PageId;
  if (NAV_ITEMS.some((item) => item.id === hash)) {
    return hash;
  }
  return "brief";
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(getInitialPage);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refreshHealth = async () => {
    try {
      const res = await api.getHealth();
      setHealth(res);
      setHealthError(null);
    } catch (err) {
      setHealthError(
        err instanceof Error
          ? err.message
          : "Cannot reach backend server on http://localhost:8000"
      );
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const handleSelectPage = (page: PageId) => {
    setActivePage(page);
    window.location.hash = page;
  };

  const currentMeta = NAV_ITEMS.find((n) => n.id === activePage) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0B101B] text-[#EEF4FC]">
      <Sidebar
        activePage={activePage}
        onSelect={handleSelectPage}
        health={health}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((prev) => !prev)}
      />

      <main className="flex-1 min-w-0 px-5 py-6 sm:px-8 lg:px-10 max-w-7xl w-full mx-auto">
        {healthError ? (
          <div className="mb-5">
            <ErrorBanner message={`Backend connection issue: ${healthError}`} />
          </div>
        ) : null}

        {currentMeta.requiresAi && health && !health.gemini_configured ? (
          <div className="mb-6">
            <KeyMissingBanner />
          </div>
        ) : null}

        {activePage === "map" ? (
          <MapPage />
        ) : activePage === "sprint" ? (
          <SprintPage />
        ) : activePage === "scaffold" ? (
          <ScaffoldPage />
        ) : (
          <section aria-labelledby="page-heading" className="space-y-6">
            <header>
              <h1 id="page-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
                {currentMeta.label}
              </h1>
              <p className="text-base text-[#A8B9D4] mt-1">{currentMeta.hint}</p>
            </header>

            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-6">
              <p className="text-base text-[#CBD7EA]">
                Mission Control shell online. Module ready for phase implementation.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
