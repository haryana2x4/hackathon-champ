import { Activity, AlertOctagon, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import type { ToolLogEntry } from "../types";

interface RunningTool {
  name: string;
  args: Record<string, unknown>;
}

interface MissionControlPanelProps {
  logs: ToolLogEntry[];
  runningTool: RunningTool | null;
}

export function MissionControlPanel({ logs, runningTool }: MissionControlPanelProps) {
  return (
    <aside
      aria-label="Mission Control tool log"
      className="rounded-xl border border-[#263452] bg-[#0E1525] flex flex-col h-[560px] lg:h-[640px]"
    >
      <div className="px-4 py-3.5 border-b border-[#24324E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
          <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-[#EEF4FC]">
            Mission Control
          </h2>
        </div>
        <span className="text-xs font-mono text-[#9EB0CC]">
          {logs.length} {logs.length === 1 ? "call" : "calls"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {runningTool ? (
          <div
            role="status"
            className="rounded-lg border border-[#22D3EE]/60 bg-[#121A2B] p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#22D3EE] flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                {runningTool.name}
              </span>
              <span className="text-[11px] font-mono text-[#22D3EE]">RUNNING</span>
            </div>
            <pre className="text-[11px] font-mono text-[#A8B9D4] whitespace-pre-wrap break-all">
              {JSON.stringify(runningTool.args, null, 2)}
            </pre>
          </div>
        ) : null}

        {logs.length === 0 && !runningTool ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10 space-y-2">
            <Activity className="w-7 h-7 text-[#4D6388]" aria-hidden="true" />
            <p className="text-sm font-medium text-[#CBD7EA]">Awaiting tool telemetry</p>
            <p className="text-xs text-[#8CA2C4]">
              Every tool Champ invokes (name, arguments, duration, and status) streams here live. Max 6 calls per message.
            </p>
          </div>
        ) : (
          [...logs].reverse().map((entry, idx) => {
            const isBlocked = entry.status === "blocked";
            const isError = entry.status === "error";
            return (
              <div
                key={`${entry.name}-${idx}`}
                data-testid="mission-control-entry"
                className={`rounded-lg border p-3 space-y-1.5 ${
                  isBlocked
                    ? "border-amber-400/50 bg-amber-950/20"
                    : isError
                      ? "border-red-400/50 bg-red-950/20"
                      : "border-[#24324E] bg-[#121A2B]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#EEF4FC] flex items-center gap-1.5">
                    {isBlocked ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                    ) : isError ? (
                      <AlertOctagon className="w-3.5 h-3.5 text-red-300" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                    )}
                    {entry.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-[#9EB0CC]">{entry.duration_ms}ms</span>
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase ${
                        isBlocked
                          ? "bg-amber-900/50 text-amber-200"
                          : isError
                            ? "bg-red-900/50 text-red-200"
                            : "bg-[#22D3EE]/15 text-[#22D3EE]"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>

                {entry.summary ? (
                  <p className="text-xs text-[#CBD7EA] break-words">{entry.summary}</p>
                ) : null}

                <pre className="text-[11px] font-mono text-[#9EB0CC] bg-[#0B101B] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.args)}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
