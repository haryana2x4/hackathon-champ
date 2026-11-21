import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-[#263452] bg-[#121A2B] p-8 flex flex-col items-center justify-center gap-3 text-center"
    >
      <Loader2 className="w-7 h-7 text-[#22D3EE] animate-spin" aria-hidden="true" />
      <p className="text-base text-[#CBD7EA]">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#2F4165] bg-[#121A2B]/80 p-8 flex flex-col items-center justify-center gap-3 text-center">
      <div className="p-3 rounded-full bg-[#1A253D] text-[#22D3EE]" aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-[#EEF4FC]">{title}</h2>
      <p className="text-base text-[#A8B9D4] max-w-xl">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3.5 flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm sm:text-base text-red-100">{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-red-200 hover:text-white underline shrink-0"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
