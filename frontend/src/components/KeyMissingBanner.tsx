import { KeyRound, RefreshCw } from "lucide-react";

interface Props {
  compact?: boolean;
  onRefresh?: () => void;
}

export function KeyMissingBanner({ compact = false, onRefresh }: Props) {
  return (
    <div
      role="alert"
      data-testid="key-missing-banner"
      className={`rounded-xl border border-[#22D3EE]/50 bg-[#121A2B] ${
        compact ? "px-4 py-3" : "p-5"
      } flex flex-wrap items-start justify-between gap-4`}
    >
      <div className="flex items-start gap-3.5 max-w-3xl">
        <KeyRound className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-[#EEF4FC] text-base">
            Add your Gemini key to .env
          </p>
          <p className="text-sm text-[#B7C7DF]">
            AI pages (Brief, Ideas, Champ, and Submission) need{" "}
            <code className="px-1.5 py-0.5 rounded bg-[#0B101B] text-[#22D3EE] text-xs">
              GEMINI_API_KEY
            </code>{" "}
            in <code className="px-1.5 py-0.5 rounded bg-[#0B101B] text-[#EEF4FC] text-xs">.env</code>.
            Map, Sprint, and Scaffold work right away without a key.
          </p>
        </div>
      </div>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A253D] hover:bg-[#233252] text-xs font-mono text-[#22D3EE] cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Recheck .env
        </button>
      ) : null}
    </div>
  );
}
