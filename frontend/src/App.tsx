import { useEffect, useState } from "react";
import { api } from "./api";
import { KeyMissingBanner } from "./components/KeyMissingBanner";
import { Sidebar, NAV_ITEMS } from "./components/Sidebar";
import { ErrorBanner } from "./components/PageState";
import { BriefPage } from "./pages/BriefPage";
import { ChampPage } from "./pages/ChampPage";
import { IdeasPage } from "./pages/IdeasPage";
import { MapPage } from "./pages/MapPage";
import { ScaffoldPage } from "./pages/ScaffoldPage";
import { SprintPage } from "./pages/SprintPage";
import { SubmissionPage } from "./pages/SubmissionPage";
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
  const [activeBriefId, setActiveBriefId] = useState<number | null>(null);
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

        {activePage === "brief" ? (
          <BriefPage
            geminiConfigured={Boolean(health?.gemini_configured)}
            activeBriefId={activeBriefId}
            onSelectBrief={setActiveBriefId}
            onGoToIdeas={(briefId) => {
              setActiveBriefId(briefId);
              handleSelectPage("ideas");
            }}
          />
        ) : activePage === "ideas" ? (
          <IdeasPage
            geminiConfigured={Boolean(health?.gemini_configured)}
            activeBriefId={activeBriefId}
            onSelectBrief={setActiveBriefId}
            onNavigate={handleSelectPage}
          />
        ) : activePage === "champ" ? (
          <ChampPage geminiConfigured={Boolean(health?.gemini_configured)} />
        ) : activePage === "map" ? (
          <MapPage />
        ) : activePage === "sprint" ? (
          <SprintPage />
        ) : activePage === "submission" ? (
          <SubmissionPage
            geminiConfigured={Boolean(health?.gemini_configured)}
            onNavigate={handleSelectPage}
          />
        ) : (
          <ScaffoldPage />
        )}
      </main>
    </div>
  );
}
