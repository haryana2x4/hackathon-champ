import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  Lock,
  Rocket,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { Idea, PageId, SubmissionKit } from "../types";

interface SubmissionPageProps {
  geminiConfigured: boolean;
  onNavigate: (page: PageId) => void;
}

type DocTab = "readme" | "pitch" | "checklist";

export function SubmissionPage({ geminiConfigured, onNavigate }: SubmissionPageProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [kit, setKit] = useState<SubmissionKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocTab>("readme");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadIdeasAndKit = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listIdeas();
      setIdeas(list);
      const preferred = list.find((i) => i.is_locked) ?? list[0] ?? null;
      if (preferred) {
        setSelectedIdeaId(preferred.id);
        const existing = await api.getSubmission(preferred.id);
        setKit(existing);
      } else {
        setSelectedIdeaId(null);
        setKit(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdeasAndKit();
  }, [loadIdeasAndKit]);

  const handleSelectIdea = async (ideaId: number) => {
    setSelectedIdeaId(ideaId);
    setError(null);
    try {
      const existing = await api.getSubmission(ideaId);
      setKit(existing);
    } catch {
      setKit(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedIdeaId) {
      setError("Lock or select an idea on the Ideas page first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const generated = await api.generateSubmission(selectedIdeaId);
      setKit(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate submission kit.");
    } finally {
      setGenerating(false);
    }
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) ?? null;

  const devpostSections = kit
    ? [
        { key: "inspiration", title: "Inspiration", body: kit.inspiration },
        { key: "what_it_does", title: "What it does", body: kit.what_it_does },
        { key: "how_we_built_it", title: "How we built it", body: kit.how_we_built_it },
        { key: "challenges", title: "Challenges", body: kit.challenges },
        { key: "accomplishments", title: "Accomplishments", body: kit.accomplishments },
        { key: "whats_next", title: "What's next", body: kit.whats_next },
      ]
    : [];

  const activeDocContent = kit
    ? activeDoc === "readme"
      ? kit.readme_md
      : activeDoc === "pitch"
        ? kit.pitch_2min_md
        : kit.demo_checklist_md
    : "";

  const activeDocFilename =
    activeDoc === "readme"
      ? "README.md"
      : activeDoc === "pitch"
        ? "pitch-2min.md"
        : "demo-checklist.md";

  return (
    <section aria-labelledby="submission-heading" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="submission-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
            Submission Kit
          </h1>
          <p className="text-base text-[#A8B9D4] mt-1">
            Generate Devpost story sections plus downloadable{" "}
            <code className="text-[#22D3EE] text-sm">README.md</code>,{" "}
            <code className="text-[#22D3EE] text-sm">pitch-2min.md</code>, and{" "}
            <code className="text-[#22D3EE] text-sm">demo-checklist.md</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {ideas.length > 0 ? (
            <select
              aria-label="Select idea for submission kit"
              value={selectedIdeaId ?? ""}
              onChange={(e) => handleSelectIdea(Number(e.target.value))}
              className="rounded-lg bg-[#121A2B] border border-[#2D3E5E] px-3 py-2.5 text-sm text-[#EEF4FC]"
            >
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.is_locked ? "★ [Locked] " : ""}
                  {idea.title}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            disabled={generating || !geminiConfigured || !selectedIdeaId}
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-50 text-[#04131C] font-semibold px-5 py-2.5 text-base cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {generating ? "Writing Kit..." : kit ? "Regenerate Kit" : "Generate Submission Kit"}
          </button>
        </div>
      </header>

      {selectedIdea ? (
        <div className="rounded-xl border border-[#263452] bg-[#121A2B] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[#CBD7EA]">
            {selectedIdea.is_locked ? (
              <Lock className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
            ) : null}
            <span>
              Project: <strong className="text-[#EEF4FC]">{selectedIdea.title}</strong> —{" "}
              {selectedIdea.one_liner}
            </span>
          </div>

          {kit ? (
            <a
              href={api.submissionDownloadUrl(kit.idea_id)}
              download
              data-testid="download-submission-zip"
              className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] text-[#04131C] font-semibold px-4 py-2 text-sm"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Download Full Kit (.zip)
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <LoadingState label="Loading submission kit..." />
      ) : generating ? (
        <LoadingState label="Drafting Devpost sections, README.md, 2-minute pitch (~300 words), and demo checklist..." />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={<Rocket className="w-6 h-6" />}
          title="Lock an idea first"
          description="Analyze a brief and lock your winning idea on the Ideas page, then return here to generate your complete Devpost submission package."
          action={
            <button
              type="button"
              onClick={() => onNavigate("ideas")}
              className="rounded-lg bg-[#22D3EE] text-[#04131C] font-semibold px-4 py-2 text-sm cursor-pointer"
            >
              Go to Ideas Page
            </button>
          }
        />
      ) : !kit ? (
        <EmptyState
          icon={<Rocket className="w-6 h-6" />}
          title="No submission kit generated yet"
          description="Click 'Generate Submission Kit' above to create all 7 Devpost sections plus README.md, pitch-2min.md, and demo-checklist.md."
        />
      ) : (
        <div className="space-y-6">
          {/* Built With Tags */}
          <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-2.5">
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#9EB0CC]">
              Built With
            </h2>
            <div className="flex flex-wrap gap-2">
              {kit.built_with.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-[#1A253D] border border-[#22D3EE]/40 text-xs font-mono text-[#22D3EE]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 6 Devpost Narrative Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {devpostSections.map((sec) => (
              <article
                key={sec.key}
                className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#EEF4FC]">{sec.title}</h2>
                  <button
                    type="button"
                    onClick={() => copyText(sec.key, sec.body)}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[#9EB0CC] hover:text-[#22D3EE] cursor-pointer"
                  >
                    {copiedKey === sec.key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm sm:text-base text-[#CBD7EA] whitespace-pre-wrap leading-relaxed">
                  {sec.body}
                </p>
              </article>
            ))}
          </div>

          {/* 3 Downloadable Files */}
          <div className="rounded-xl border border-[#263452] bg-[#121A2B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#24324E] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Generated files">
                {(
                  [
                    { id: "readme", label: "README.md" },
                    { id: "pitch", label: `pitch-2min.md (${kit.pitch_word_count} words)` },
                    { id: "checklist", label: "demo-checklist.md" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeDoc === tab.id}
                    onClick={() => setActiveDoc(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-mono font-semibold cursor-pointer ${
                      activeDoc === tab.id
                        ? "bg-[#22D3EE] text-[#04131C]"
                        : "bg-[#0B101B] text-[#CBD7EA] border border-[#2D3E5E] hover:bg-[#1A253D]"
                    }`}
                  >
                    <FileCode2 className="w-4 h-4" aria-hidden="true" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(activeDoc, activeDocContent)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A253D] hover:bg-[#233252] text-xs font-mono text-[#EEF4FC] cursor-pointer"
                >
                  {copiedKey === activeDoc ? (
                    <Check className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                  )}
                  Copy {activeDocFilename}
                </button>
                <a
                  href={api.submissionDownloadUrl(kit.idea_id, activeDoc)}
                  download={activeDocFilename}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A253D] hover:bg-[#233252] border border-[#22D3EE]/50 text-xs font-mono text-[#22D3EE]"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download {activeDocFilename}
                </a>
              </div>
            </div>

            <pre className="p-5 text-sm font-mono text-[#DCE6F5] bg-[#0B101B] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto">
              {activeDocContent}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
