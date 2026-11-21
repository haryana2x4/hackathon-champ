import { useEffect, useState } from "react";
import { CheckCircle2, FolderGit2, Hammer, Lock, Terminal } from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { Idea, ScaffoldResult } from "../types";

export function ScaffoldPage() {
  const [lockedIdea, setLockedIdea] = useState<Idea | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScaffoldResult | null>(null);

  const [projectName, setProjectName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [techInput, setTechInput] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ideas = await api.listIdeas();
        if (!active) return;
        const locked = ideas.find((i) => i.is_locked) ?? null;
        setLockedIdea(locked);
      } catch {
        // Ideas endpoint may be empty or not yet populated; manual scaffold still works
      } finally {
        if (active) setLoadingIdeas(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleScaffoldLocked = async () => {
    if (!lockedIdea) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.createScaffold({ idea_id: lockedIdea.id });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate starter repo.");
    } finally {
      setGenerating(false);
    }
  };

  const handleScaffoldManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError("Enter a project name to generate your starter repo.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const tech = techInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.createScaffold({
        project_name: projectName.trim(),
        one_liner: oneLiner.trim() || undefined,
        tech,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate starter repo.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section aria-labelledby="scaffold-heading" className="space-y-6">
      <header>
        <h1 id="scaffold-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
          Starter Repo Scaffold
        </h1>
        <p className="text-base text-[#A8B9D4] mt-1">
          Generate a deterministic FastAPI + React starter project inside{" "}
          <code className="px-1.5 py-0.5 rounded bg-[#121A2B] text-[#22D3EE] text-sm">
            workspace_out/
          </code>{" "}
          with its own README and working <code className="text-sm text-[#EEF4FC]">/health</code> endpoint. Works offline with no AI key.
        </p>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loadingIdeas ? (
        <LoadingState label="Checking for locked ideas..." />
      ) : lockedIdea ? (
        <div className="rounded-xl border border-[#22D3EE]/50 bg-[#121A2B] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-[#22D3EE] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Locked Idea Ready
            </p>
            <h2 className="text-xl font-bold text-[#EEF4FC]">{lockedIdea.title}</h2>
            <p className="text-sm text-[#CBD7EA]">{lockedIdea.one_liner}</p>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={handleScaffoldLocked}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-60 text-[#04131C] font-semibold px-5 py-2.5 text-base cursor-pointer"
          >
            <Hammer className="w-4 h-4" aria-hidden="true" />
            {generating ? "Scaffolding..." : "Scaffold Locked Idea"}
          </button>
        </div>
      ) : null}

      {/* Manual Scaffold Form (works with zero API key & zero locked ideas) */}
      <form
        onSubmit={handleScaffoldManual}
        className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-[#EEF4FC]">
            {lockedIdea ? "Or scaffold a custom project name" : "Generate a starter project"}
          </h2>
          <p className="text-sm text-[#9EB0CC]">
            No Gemini key needed — uses clean, deterministic FastAPI + React templates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="scaf-name" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Project name *
            </label>
            <input
              id="scaf-name"
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Pulse Guard"
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
            />
          </div>

          <div>
            <label htmlFor="scaf-tech" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Tech stack tags (comma-separated)
            </label>
            <input
              id="scaf-tech"
              type="text"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              placeholder="FastAPI, React, SQLite"
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="scaf-desc" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
            One-line description
          </label>
          <input
            id="scaf-desc"
            type="text"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="What does your project do?"
            className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-60 text-[#04131C] font-semibold px-5 py-2.5 text-base cursor-pointer"
        >
          <FolderGit2 className="w-4 h-4" aria-hidden="true" />
          {generating ? "Generating..." : "Generate Starter Repo"}
        </button>
      </form>

      {result ? (
        <div
          data-testid="scaffold-result"
          className="rounded-xl border border-[#22D3EE]/50 bg-[#121A2B] p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg font-bold text-[#EEF4FC]">Starter repository created</h2>
              <p className="text-sm font-mono text-[#22D3EE] break-all">{result.path}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#0B101B] border border-[#24324E] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] mb-2">
                Generated Files ({result.files.length})
              </p>
              <ul className="space-y-1 font-mono text-xs text-[#CBD7EA]">
                {result.files.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-[#0B101B] border border-[#24324E] p-4 space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                Start Generated Backend
              </p>
              <pre className="text-xs font-mono text-[#EEF4FC] overflow-x-auto whitespace-pre-wrap">
{`cd workspace_out/${result.slug}/backend
uvicorn main:app --port 8001`}
              </pre>
              <p className="text-xs text-[#9EB0CC]">
                Then visit <code className="text-[#22D3EE]">http://localhost:8001/health</code>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<FolderGit2 className="w-6 h-6" />}
          title="No scaffold generated this session"
          description="Lock an idea on the Ideas page or type a project name above to create a ready-to-run FastAPI + React starter folder."
        />
      )}
    </section>
  );
}
