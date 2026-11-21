import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  FolderGit2,
  Lightbulb,
  Lock,
  Rocket,
  Sparkles,
  Unlock,
} from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { Brief, Idea, PageId } from "../types";

interface IdeasPageProps {
  geminiConfigured: boolean;
  activeBriefId: number | null;
  onSelectBrief: (id: number) => void;
  onNavigate: (page: PageId) => void;
}

export function IdeasPage({
  geminiConfigured,
  activeBriefId,
  onSelectBrief,
  onNavigate,
}: IdeasPageProps) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lockingId, setLockingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBriefId = activeBriefId ?? briefs[0]?.id ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const briefList = await api.listBriefs();
      setBriefs(briefList);
      const targetId = activeBriefId ?? briefList[0]?.id ?? null;
      if (targetId !== null && activeBriefId === null) {
        onSelectBrief(targetId);
      }
      const ideaList = targetId ? await api.listIdeas(targetId) : await api.listIdeas();
      setIdeas(ideaList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ideas.");
    } finally {
      setLoading(false);
    }
  }, [activeBriefId, onSelectBrief]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!selectedBriefId) {
      setError("Analyze a hackathon brief first on the Brief page.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const created = await api.generateIdeas(selectedBriefId);
      setIdeas(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ideas.");
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async (ideaId: number) => {
    setLockingId(ideaId);
    setError(null);
    try {
      const locked = await api.lockIdea(ideaId);
      setIdeas((prev) =>
        prev.map((item) => ({
          ...item,
          is_locked: item.id === locked.id,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not lock idea.");
    } finally {
      setLockingId(null);
    }
  };

  const selectedBrief = briefs.find((b) => b.id === selectedBriefId) ?? null;

  return (
    <section aria-labelledby="ideas-heading" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="ideas-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
            Idea Generator &amp; Scorer
          </h1>
          <p className="text-base text-[#A8B9D4] mt-1">
            Generate 3 distinct hackathon ideas scored 1–5 against your rubric, then lock one to power Scaffold &amp; Submission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {briefs.length > 0 ? (
            <select
              aria-label="Select brief for ideas"
              value={selectedBriefId ?? ""}
              onChange={(e) => onSelectBrief(Number(e.target.value))}
              className="rounded-lg bg-[#121A2B] border border-[#2D3E5E] px-3 py-2.5 text-sm text-[#EEF4FC]"
            >
              {briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            disabled={generating || !geminiConfigured || !selectedBriefId}
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-50 text-[#04131C] font-semibold px-5 py-2.5 text-base cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {generating ? "Generating 3 Ideas..." : "Generate 3 Ideas"}
          </button>
        </div>
      </header>

      {selectedBrief ? (
        <div className="rounded-xl border border-[#263452] bg-[#121A2B] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[#CBD7EA]">
            Active brief: <strong className="text-[#EEF4FC]">{selectedBrief.title}</strong>
          </span>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#1A253D] text-[#22D3EE]">
            {selectedBrief.rubric_label}
          </span>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <LoadingState label="Loading ideas..." />
      ) : generating ? (
        <LoadingState label="Brainstorming 3 ideas that fit sponsor tech & rules and scoring each against the rubric..." />
      ) : briefs.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="w-6 h-6" />}
          title="Analyze a brief first"
          description="Head to the Brief page to paste a hackathon URL or rules text. Once analyzed, come back here to generate 3 scored ideas."
          action={
            <button
              type="button"
              onClick={() => onNavigate("brief")}
              className="rounded-lg bg-[#22D3EE] text-[#04131C] font-semibold px-4 py-2 text-sm cursor-pointer"
            >
              Go to Brief Page
            </button>
          }
        />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="w-6 h-6" />}
          title="No ideas generated for this brief yet"
          description="Click 'Generate 3 Ideas' above to get three buildable concepts tailored to this hackathon's sponsor tech, rules, and judging criteria."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {ideas.map((idea) => (
            <article
              key={idea.id}
              data-testid={`idea-card-${idea.id}`}
              className={`rounded-xl border p-5 flex flex-col justify-between gap-5 ${
                idea.is_locked
                  ? "border-[#22D3EE] bg-[#121A2B] shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                  : "border-[#263452] bg-[#121A2B]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#EEF4FC]">{idea.title}</h2>
                    <p className="text-sm text-[#22D3EE] mt-1">{idea.one_liner}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-[#0B101B] border border-[#22D3EE]/40 font-mono text-sm font-bold text-[#22D3EE]">
                      {idea.average_score.toFixed(1)}/5
                    </span>
                    <p className="text-xs text-[#9EB0CC] mt-1 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      ~{idea.build_hours}h
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC]">
                      Problem
                    </h3>
                    <p className="text-[#CBD7EA] mt-0.5">{idea.problem}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC]">
                      Solution
                    </h3>
                    <p className="text-[#CBD7EA] mt-0.5">{idea.solution}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] mb-1.5">
                    Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {idea.tech.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-[#1A253D] text-xs font-mono text-[#EEF4FC]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] mb-2">
                    Rubric Scores
                  </h3>
                  <ul className="space-y-2">
                    {idea.scores.map((s, idx) => (
                      <li key={idx} className="rounded-lg bg-[#0B101B] border border-[#24324E] p-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#EEF4FC]">{s.criterion}</span>
                          <span className="font-mono text-[#22D3EE]">{s.score} / 5</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#1A253D] mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-[#22D3EE]"
                            style={{ width: `${(s.score / 5) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#A8B9D4] mt-1.5">{s.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {idea.risks.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                      Key Risks
                    </h3>
                    <ul className="list-disc list-inside text-xs text-[#A8B9D4] space-y-1">
                      {idea.risks.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="pt-3 border-t border-[#24324E] space-y-2">
                {idea.is_locked ? (
                  <>
                    <div
                      data-testid="locked-idea-badge"
                      className="w-full rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE] text-[#22D3EE] font-semibold px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" aria-hidden="true" />
                      Locked Idea
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate("scaffold")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1A253D] hover:bg-[#233252] text-xs font-medium text-[#EEF4FC] py-2 px-3 cursor-pointer"
                      >
                        <FolderGit2 className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                        Scaffold
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate("submission")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1A253D] hover:bg-[#233252] text-xs font-medium text-[#EEF4FC] py-2 px-3 cursor-pointer"
                      >
                        <Rocket className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                        Submission
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={lockingId === idea.id}
                    onClick={() => handleLock(idea.id)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-60 text-[#04131C] font-semibold px-4 py-2.5 text-sm cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" aria-hidden="true" />
                    {lockingId === idea.id ? "Locking..." : "Lock This Idea"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
