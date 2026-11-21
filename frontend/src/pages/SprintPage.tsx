import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Clock, ShieldAlert, Square, Timer, Users } from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { SprintPlan } from "../types";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.parse(targetIso) - nowMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SprintPage() {
  const [plan, setPlan] = useState<SprintPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadSprint = useCallback(async () => {
    setLoading(true);
    try {
      const latest = await api.getLatestSprint();
      setPlan(latest);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sprint plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSprint();
  }, [loadSprint]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const setQuickHours = (hoursAhead: number) => {
    const target = new Date(Date.now() + hoursAhead * 3600 * 1000);
    setDeadlineLocal(toLocalDateTimeInputValue(target));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineLocal) {
      setError("Pick a submission deadline (or click +24h / +36h / +48h).");
      return;
    }
    const parsed = new Date(deadlineLocal);
    if (Number.isNaN(parsed.getTime())) {
      setError("Invalid deadline date/time.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await api.createSprint({
        deadline_iso: parsed.toISOString(),
        team_size: teamSize,
      });
      setPlan(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sprint plan.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    try {
      const updated = await api.patchTask(taskId, { completed: !currentCompleted });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    }
  };

  const completedCount = plan ? plan.tasks.filter((t) => t.completed).length : 0;
  const sumTaskMinutes = plan ? plan.tasks.reduce((acc, t) => acc + t.duration_minutes, 0) : 0;

  return (
    <section aria-labelledby="sprint-heading" className="space-y-6">
      <header>
        <h1 id="sprint-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
          Sprint Planner
        </h1>
        <p className="text-base text-[#A8B9D4] mt-1">
          Turn your deadline into a strict time-boxed schedule: 10% setup, 50% build, 15% test &amp; fix (feature freeze at 75%), 15% polish &amp; demo, 10% submit buffer.
        </p>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="sprint-deadline" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Submission deadline *
            </label>
            <input
              id="sprint-deadline"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC]"
            />
          </div>

          <div>
            <label htmlFor="sprint-team" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
              Team size (1–20) *
            </label>
            <input
              id="sprint-team"
              type="number"
              min={1}
              max={20}
              value={teamSize}
              onChange={(e) => setTeamSize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC]"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-60 text-[#04131C] font-semibold px-4 py-2.5 text-base transition-colors cursor-pointer"
          >
            <Timer className="w-4 h-4" aria-hidden="true" />
            {creating ? "Building Plan..." : "Build Sprint Plan"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#9EB0CC]">
          <span>Quick set deadline:</span>
          {[12, 24, 36, 48].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setQuickHours(h)}
              className="px-2.5 py-1 rounded-md bg-[#1A253D] hover:bg-[#233252] text-[#EEF4FC] font-mono cursor-pointer"
            >
              +{h}h
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <LoadingState label="Loading saved sprint..." />
      ) : !plan ? (
        <EmptyState
          icon={<Timer className="w-6 h-6" />}
          title="No sprint plan created yet"
          description="Choose your hackathon deadline and team size above to generate a balanced schedule with a live countdown and 75% feature freeze."
        />
      ) : (
        <div className="space-y-6">
          {/* Live Telemetry Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#22D3EE]/50 bg-[#121A2B] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                Live Countdown
              </p>
              <p
                data-testid="sprint-countdown"
                className="text-2xl sm:text-3xl font-mono font-bold text-[#22D3EE] mt-1.5"
              >
                {formatCountdown(plan.deadline_iso, nowMs)}
              </p>
              <p className="text-xs text-[#9EB0CC] mt-1">
                Due {new Date(plan.deadline_iso).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC]">
                Total Planned Time
              </p>
              <p data-testid="sprint-total-hours" className="text-2xl sm:text-3xl font-mono font-bold text-[#EEF4FC] mt-1.5">
                {(sumTaskMinutes / 60).toFixed(1)}h
              </p>
              <p className="text-xs text-[#9EB0CC] mt-1">
                {sumTaskMinutes} min allocated (= 100% of {plan.total_minutes} min)
              </p>
            </div>

            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                Feature Freeze (75%)
              </p>
              <p className="text-xl font-mono font-bold text-[#EEF4FC] mt-1.5">
                {formatCountdown(plan.feature_freeze_iso, nowMs)}
              </p>
              <p className="text-xs text-[#9EB0CC] mt-1">
                At {formatDuration(plan.feature_freeze_minutes)} ({new Date(plan.feature_freeze_iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
              </p>
            </div>

            <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9EB0CC] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
                Team &amp; Progress
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-[#EEF4FC] mt-1.5">
                {completedCount}/{plan.tasks.length}
              </p>
              <p className="text-xs text-[#9EB0CC] mt-1">
                Team of {plan.team_size} • tasks done
              </p>
            </div>
          </div>

          {/* Phase Split Bar */}
          <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#EEF4FC]">Time Allocation Breakdown</h2>
              <span className="text-xs font-mono text-[#22D3EE]">
                Feature Freeze at 75% ({formatDuration(plan.feature_freeze_minutes)})
              </span>
            </div>

            <div className="flex w-full h-4 rounded-full overflow-hidden bg-[#0B101B] border border-[#263452]">
              {plan.phases.map((p, idx) => (
                <div
                  key={p.phase}
                  style={{ width: `${p.percent}%` }}
                  title={`${p.phase}: ${p.percent}% (${formatDuration(p.minutes)})`}
                  className={`h-full border-r border-[#0B101B] ${
                    idx === 0
                      ? "bg-[#22D3EE]/35"
                      : idx === 1
                        ? "bg-[#22D3EE]/85"
                        : idx === 2
                          ? "bg-[#22D3EE]/55"
                          : idx === 3
                            ? "bg-[#9EB0CC]/45"
                            : "bg-[#9EB0CC]/25"
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              {plan.phases.map((p) => (
                <div
                  key={p.phase}
                  className={`rounded-lg p-2.5 border ${
                    p.is_feature_freeze_end
                      ? "border-[#22D3EE]/60 bg-[#0B101B]"
                      : "border-[#24324E] bg-[#0B101B]"
                  }`}
                >
                  <p className="text-xs font-semibold text-[#EEF4FC]">{p.phase}</p>
                  <p className="text-sm font-mono text-[#22D3EE] mt-0.5">
                    {p.percent}% • {formatDuration(p.minutes)}
                  </p>
                  {p.is_feature_freeze_end ? (
                    <p className="text-[11px] text-[#CBD7EA] mt-0.5">Freeze at end (75%)</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Checklist Grouped by Phase */}
          <div className="space-y-4">
            {plan.phases.map((phase) => {
              const phaseTasks = plan.tasks.filter((t) => t.phase === phase.phase);
              return (
                <div
                  key={phase.phase}
                  className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[#EEF4FC]">{phase.phase}</h3>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#1A253D] text-[#22D3EE]">
                      {phase.percent}% • {formatDuration(phase.minutes)}
                    </span>
                  </div>

                  <ul className="space-y-2.5">
                    {phaseTasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task.id, task.completed)}
                          role="checkbox"
                          aria-checked={task.completed}
                          className={`w-full text-left rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                            task.completed
                              ? "border-[#22D3EE]/40 bg-[#0B101B]/60"
                              : "border-[#24324E] bg-[#0B101B] hover:border-[#22D3EE]/60"
                          }`}
                        >
                          {task.completed ? (
                            <CheckSquare className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <Square className="w-5 h-5 text-[#7F94B8] shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-base font-medium ${
                                task.completed ? "line-through text-[#8CA2C4]" : "text-[#EEF4FC]"
                              }`}
                            >
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#9EB0CC]">
                              <span>Owner: {task.owner}</span>
                              <span className="font-mono">Duration: {formatDuration(task.duration_minutes)}</span>
                              {task.is_feature_freeze ? (
                                <span className="px-2 py-0.5 rounded bg-[#22D3EE]/15 text-[#22D3EE] font-mono">
                                  75% FEATURE FREEZE
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
