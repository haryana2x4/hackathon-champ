import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Calendar,
  CheckSquare,
  Cpu,
  ExternalLink,
  FileText,
  Scale,
  Sparkles,
  Square,
} from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { Brief } from "../types";

interface BriefPageProps {
  geminiConfigured: boolean;
  activeBriefId: number | null;
  onSelectBrief: (id: number) => void;
  onGoToIdeas: (briefId: number) => void;
}

export function BriefPage({
  geminiConfigured,
  activeBriefId,
  onSelectBrief,
  onGoToIdeas,
}: BriefPageProps) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"url" | "text">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});

  const loadBriefs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listBriefs();
      setBriefs(list);
      if (list.length > 0 && activeBriefId === null) {
        onSelectBrief(list[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved briefs.");
    } finally {
      setLoading(false);
    }
  }, [activeBriefId, onSelectBrief]);

  useEffect(() => {
    loadBriefs();
  }, [loadBriefs]);

  const currentBrief =
    briefs.find((b) => b.id === activeBriefId) ?? briefs[0] ?? null;

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload =
      mode === "url"
        ? { url: urlInput.trim() }
        : { text: textInput.trim() };
    if (mode === "url" && !payload.url) {
      setError("Paste a public hackathon URL first.");
      return;
    }
    if (mode === "text" && !payload.text) {
      setError("Paste the hackathon brief text first.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const created = await api.analyzeBrief(payload);
      setBriefs((prev) => [created, ...prev.filter((b) => b.id !== created.id)]);
      onSelectBrief(created.id);
      setUrlInput("");
      setTextInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze brief.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRule = (briefId: number, idx: number) => {
    const key = `${briefId}:${idx}`;
    setCheckedRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section aria-labelledby="brief-heading" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="brief-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
            Hackathon Brief Analyzer
          </h1>
          <p className="text-base text-[#A8B9D4] mt-1">
            Paste a public hackathon URL or brief text to extract deadlines, sponsor tech, rules, and exact judging criteria.
          </p>
        </div>

        {briefs.length > 1 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="brief-select" className="text-sm text-[#A8B9D4]">
              Saved brief:
            </label>
            <select
              id="brief-select"
              value={currentBrief?.id ?? ""}
              onChange={(e) => onSelectBrief(Number(e.target.value))}
              className="rounded-lg bg-[#121A2B] border border-[#2D3E5E] px-3 py-2 text-sm text-[#EEF4FC]"
            >
              {briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {/* Analyzer Form */}
      <form
        onSubmit={handleAnalyze}
        className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-4"
      >
        <div className="flex items-center gap-2" role="tablist" aria-label="Brief input mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "url"}
            onClick={() => setMode("url")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === "url"
                ? "bg-[#22D3EE] text-[#04131C]"
                : "bg-[#0B101B] text-[#CBD7EA] border border-[#2D3E5E] hover:bg-[#1A253D]"
            }`}
          >
            Paste URL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            onClick={() => setMode("text")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === "text"
                ? "bg-[#22D3EE] text-[#04131C]"
                : "bg-[#0B101B] text-[#CBD7EA] border border-[#2D3E5E] hover:bg-[#1A253D]"
            }`}
          >
            Paste Brief Text
          </button>
        </div>

        {mode === "url" ? (
          <div>
            <label htmlFor="brief-url" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Public hackathon page URL
            </label>
            <input
              id="brief-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example-hackathon.devpost.com/"
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="brief-text" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Hackathon rules, prizes, and judging criteria text
            </label>
            <textarea
              id="brief-text"
              rows={6}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste the hackathon description, rules, sponsor APIs, deadlines, and judging rubric..."
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#9EB0CC]">
            Champ never invents judging criteria. If a page lists none, a clearly labelled default rubric is shown.
          </p>
          <button
            type="submit"
            disabled={analyzing || !geminiConfigured}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-50 text-[#04131C] font-semibold px-5 py-2.5 text-base transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {analyzing ? "Analyzing Brief..." : "Analyze Brief"}
          </button>
        </div>
      </form>

      {loading ? (
        <LoadingState label="Loading analyzed briefs..." />
      ) : analyzing ? (
        <LoadingState label="Reading the hackathon brief and extracting rules & judging criteria..." />
      ) : !currentBrief ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No brief analyzed yet"
          description="Paste a public hackathon URL or brief text above. You will get a structured summary card, sponsor tech list, rules checklist, and judging rubric."
        />
      ) : (
        <div className="space-y-6">
          {/* Brief Overview Card */}
          <article className="rounded-xl border border-[#263452] bg-[#121A2B] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                {currentBrief.theme ? (
                  <span className="inline-block text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#22D3EE]/15 text-[#22D3EE]">
                    {currentBrief.theme}
                  </span>
                ) : null}
                <h2 className="text-2xl font-bold text-[#EEF4FC]">{currentBrief.title}</h2>
                {currentBrief.source ? (
                  <p className="text-xs text-[#9EB0CC] flex items-center gap-1.5 break-all">
                    Source:{" "}
                    {/^https?:\/\//i.test(currentBrief.source) ? (
                      <a
                        href={currentBrief.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#22D3EE] underline inline-flex items-center gap-1"
                      >
                        {currentBrief.source}
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <span>{currentBrief.source}</span>
                    )}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onGoToIdeas(currentBrief.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] text-[#04131C] font-semibold px-4 py-2.5 text-sm sm:text-base cursor-pointer"
              >
                Generate 3 Ideas
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-base text-[#D7E2F1] leading-relaxed">{currentBrief.summary}</p>

            {/* Deadlines, Prizes, Sponsor Tech */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-[#0B101B] border border-[#24324E] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[#EEF4FC] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
                  Deadlines
                </h3>
                {currentBrief.deadlines.length === 0 ? (
                  <p className="text-sm text-[#8CA2C4]">None listed on page.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-[#CBD7EA]">
                    {currentBrief.deadlines.map((d, i) => (
                      <li key={i}>
                        <span className="font-medium text-[#EEF4FC]">{d.label}</span>
                        {d.iso ? (
                          <span className="block text-xs font-mono text-[#22D3EE]">{d.iso}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg bg-[#0B101B] border border-[#24324E] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[#EEF4FC] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
                  Prizes
                </h3>
                {currentBrief.prizes.length === 0 ? (
                  <p className="text-sm text-[#8CA2C4]">None listed on page.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-[#CBD7EA] list-disc list-inside">
                    {currentBrief.prizes.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg bg-[#0B101B] border border-[#24324E] p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[#EEF4FC] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
                  Sponsor Tech &amp; Tracks
                </h3>
                {currentBrief.sponsor_tech.length === 0 ? (
                  <p className="text-sm text-[#8CA2C4]">No specific sponsor tech listed.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentBrief.sponsor_tech.map((t, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-[#1A253D] border border-[#2F4165] text-xs font-mono text-[#22D3EE]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Judging Criteria + Rules Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-[#EEF4FC] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#22D3EE]" aria-hidden="true" />
                  Judging Rubric
                </h3>
                <span
                  data-testid="rubric-label"
                  className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#1A253D] text-[#22D3EE] border border-[#22D3EE]/40"
                >
                  {currentBrief.rubric_label}
                </span>
              </div>

              {currentBrief.judging_criteria.length === 0 ? (
                <p className="text-xs text-[#A8B9D4]">
                  No organiser judging criteria were found on the source page, so Champ uses this standard fallback rubric for idea scoring:
                </p>
              ) : null}

              <ul className="space-y-3">
                {currentBrief.effective_rubric.map((c, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg bg-[#0B101B] border border-[#24324E] p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#EEF4FC]">{c.name}</span>
                      {c.weight !== null ? (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#22D3EE]/15 text-[#22D3EE]">
                          {c.weight}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-[#A8B9D4]">{c.description}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-4">
              <h3 className="text-lg font-semibold text-[#EEF4FC]">Rules &amp; Compliance Checklist</h3>
              {currentBrief.rules.length === 0 ? (
                <p className="text-sm text-[#8CA2C4]">
                  No explicit rules were extracted from this brief. Double-check official eligibility rules before submitting.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {currentBrief.rules.map((rule, idx) => {
                    const checked = Boolean(checkedRules[`${currentBrief.id}:${idx}`]);
                    return (
                      <li key={idx}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggleRule(currentBrief.id, idx)}
                          className={`w-full text-left rounded-lg border px-3.5 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                            checked
                              ? "border-[#22D3EE]/40 bg-[#0B101B]/60"
                              : "border-[#24324E] bg-[#0B101B] hover:border-[#22D3EE]/50"
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <Square className="w-5 h-5 text-[#7F94B8] shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <span
                            className={`text-sm sm:text-base ${
                              checked ? "line-through text-[#8CA2C4]" : "text-[#EEF4FC]"
                            }`}
                          >
                            {rule}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
