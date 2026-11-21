import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, ShieldAlert, Trash2, User } from "lucide-react";
import { api, streamChat } from "../api";
import { MissionControlPanel } from "../components/MissionControlPanel";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { ChatMessage, ToolLogEntry } from "../types";

interface ChampPageProps {
  geminiConfigured: boolean;
}

export function ChampPage({ geminiConfigured }: ChampPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [runningTool, setRunningTool] = useState<{
    name: string;
    args: Record<string, unknown>;
  } | null>(null);
  const [sessionToolLogs, setSessionToolLogs] = useState<ToolLogEntry[]>([]);
  const [allowCodeRun, setAllowCodeRun] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const history = await api.listChatMessages();
      setMessages(history);
      const existingLogs = history.flatMap((m) => m.tool_logs || []);
      setSessionToolLogs(existingLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingReply]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    setStreaming(true);
    setStreamingReply("");
    setRunningTool(null);

    const optimisticUser: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
      tool_logs: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    let accumulated = "";
    const turnLogs: ToolLogEntry[] = [];

    try {
      await streamChat(
        { message: trimmed, allow_code_run: allowCodeRun },
        {
          onToolStart: (tool) => {
            setRunningTool(tool);
          },
          onToolEnd: (entry) => {
            setRunningTool(null);
            turnLogs.push(entry);
            setSessionToolLogs((prev) => [...prev, entry]);
          },
          onToken: (text) => {
            accumulated += text;
            setStreamingReply(accumulated);
          },
          onDone: (donePayload) => {
            setRunningTool(null);
            const finalMsg: ChatMessage = {
              id: Date.now() + 1,
              role: "assistant",
              content: donePayload.content || accumulated,
              tool_logs: donePayload.tool_logs || turnLogs,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, finalMsg]);
            setStreamingReply("");
          },
          onError: (msg) => {
            setRunningTool(null);
            setError(msg);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed.");
    } finally {
      setStreaming(false);
      setRunningTool(null);
    }
  };

  const handleClear = async () => {
    try {
      await api.clearChatMessages();
      setMessages([]);
      setSessionToolLogs([]);
      setStreamingReply("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear chat history.");
    }
  };

  return (
    <section aria-labelledby="champ-heading" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="champ-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
            Champ — AI Co-Pilot
          </h1>
          <p className="text-base text-[#A8B9D4] mt-1">
            Ask Champ to research GitHub repos, find free APIs, inspect public URLs, locate cities, write files to{" "}
            <code className="text-[#22D3EE] text-sm">workspace_out/</code>, or test Python snippets.
          </p>
        </div>

        {messages.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={streaming}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A253D] hover:bg-[#233252] text-sm text-[#CBD7EA] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear Chat
          </button>
        ) : null}
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {/* Code execution toggle + explicit non-sandbox notice */}
      <div className="rounded-xl border border-[#263452] bg-[#121A2B] px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 max-w-2xl">
          <ShieldAlert className="w-5 h-5 text-[#22D3EE] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#EEF4FC]">
              Python Code Execution ({allowCodeRun ? "ON" : "OFF — Refused by default"})
            </p>
            <p className="text-xs text-[#A8B9D4] mt-0.5">
              <strong>This is not a full sandbox.</strong> When enabled,{" "}
              <code className="text-[#EEF4FC]">run_python</code> executes locally via Python in a temporary folder (10s timeout, 1 MB cap, without your <code className="text-[#EEF4FC]">.env</code> keys). Only turn on for code you trust.
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            role="switch"
            aria-label="Allow Python code execution"
            checked={allowCodeRun}
            onChange={(e) => setAllowCodeRun(e.target.checked)}
            className="w-5 h-5 accent-[#22D3EE] cursor-pointer"
          />
          <span className="text-sm font-mono font-semibold text-[#EEF4FC]">
            {allowCodeRun ? "ENABLED" : "DISABLED"}
          </span>
        </label>
      </div>

      {/* Main Split: Chat + Mission Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Chat Column */}
        <div className="lg:col-span-7 xl:col-span-8 rounded-xl border border-[#263452] bg-[#121A2B] flex flex-col h-[560px] lg:h-[640px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <LoadingState label="Loading conversation..." />
            ) : messages.length === 0 && !streaming ? (
              <EmptyState
                icon={<Bot className="w-6 h-6" />}
                title="Champ is standing by"
                description="Ask a question below. Champ can call fetch_url, github_repo, search_free_apis, find_place, create_file, and run_python — every call appears live in Mission Control."
              />
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm sm:text-base whitespace-pre-wrap break-words ${
                        msg.role === "user"
                          ? "bg-[#22D3EE] text-[#04131C] font-medium"
                          : "bg-[#0B101B] border border-[#24324E] text-[#EEF4FC]"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {msg.role === "user" ? (
                      <div className="w-8 h-8 rounded-lg bg-[#1A253D] border border-[#2F4165] flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-[#CBD7EA]" aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>
                ))}

                {streaming ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/15 border border-[#22D3EE]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
                    </div>
                    <div
                      data-testid="champ-streaming-reply"
                      className="max-w-[85%] rounded-xl px-4 py-3 text-sm sm:text-base bg-[#0B101B] border border-[#22D3EE]/50 text-[#EEF4FC] whitespace-pre-wrap break-words"
                    >
                      {streamingReply || (runningTool ? `Running ${runningTool.name}...` : "Thinking...")}
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="p-4 border-t border-[#24324E] flex items-center gap-3 bg-[#0E1525] rounded-b-xl"
          >
            <label htmlFor="champ-input" className="sr-only">
              Message Champ
            </label>
            <input
              id="champ-input"
              type="text"
              value={input}
              disabled={streaming || !geminiConfigured}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                geminiConfigured
                  ? "Ask Champ anything about your hackathon, repos, or free APIs..."
                  : "Add your Gemini key to .env to chat with Champ"
              }
              className="flex-1 rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-4 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !geminiConfigured || !input.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-50 text-[#04131C] font-semibold px-4 py-2.5 text-base cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {streaming ? "Working..." : "Send"}
            </button>
          </form>
        </div>

        {/* Mission Control Panel */}
        <div className="lg:col-span-5 xl:col-span-4">
          <MissionControlPanel logs={sessionToolLogs} runningTool={runningTool} />
        </div>
      </div>
    </section>
  );
}
