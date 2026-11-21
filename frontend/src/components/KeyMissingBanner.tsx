import { KeyRound } from "lucide-react";

interface Props {
  compact?: boolean;
}

export function KeyMissingBanner({ compact = false }: Props) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-[#22D3EE]/50 bg-[#121A2B] ${
        compact ? "px-4 py-3" : "p-5"
      } flex items-start gap-3.5`}
    >
      <KeyRound className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-[#EEF4FC] text-base">
          Add your Gemini key to .env
        </p>
        <p className="text-sm text-[#B7C7DF]">
          AI features (Brief analysis, Idea generation, Champ chat, and Submission writing) need{" "}
          <code className="px-1.5 py-0.5 rounded bg-[#0B101B] text-[#22D3EE] text-xs">
            GEMINI_API_KEY
          </code>{" "}
          in the project <code className="px-1.5 py-0.5 rounded bg-[#0B101B] text-[#EEF4FC] text-xs">.env</code>{" "}
          file. Map, Sprint, and Scaffold work right away without a key.
        </p>
      </div>
    </div>
  );
}
