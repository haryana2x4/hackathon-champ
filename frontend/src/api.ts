import type {
  Brief,
  ChatMessage,
  Hackathon,
  HealthResponse,
  Idea,
  ScaffoldResult,
  SprintPlan,
  SprintTask,
  SubmissionKit,
  ToolLogEntry,
} from "./types";

export const API_BASE = "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
        message = data.detail[0].msg;
      }
    } catch {
      // keep fallback message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  getHealth: () => request<HealthResponse>("/api/health"),

  // Briefs
  listBriefs: () => request<Brief[]>("/api/briefs"),
  getBrief: (id: number) => request<Brief>(`/api/briefs/${id}`),
  analyzeBrief: (payload: { url?: string; text?: string }) =>
    request<Brief>("/api/briefs/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Ideas
  listIdeas: (briefId?: number) =>
    request<Idea[]>(briefId ? `/api/ideas?brief_id=${briefId}` : "/api/ideas"),
  generateIdeas: (brief_id: number) =>
    request<Idea[]>("/api/ideas/generate", {
      method: "POST",
      body: JSON.stringify({ brief_id }),
    }),
  lockIdea: (id: number) =>
    request<Idea>(`/api/ideas/${id}/lock`, { method: "POST" }),

  // Hackathons / Map
  listHackathons: () => request<Hackathon[]>("/api/hackathons"),
  addHackathon: (payload: {
    name: string;
    link: string;
    date: string;
    location: string;
  }) =>
    request<Hackathon>("/api/hackathons", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteHackathon: (id: number) =>
    request<void>(`/api/hackathons/${id}`, { method: "DELETE" }),

  // Sprint
  getLatestSprint: () => request<SprintPlan | null>("/api/sprint"),
  createSprint: (payload: { deadline_iso: string; team_size: number }) =>
    request<SprintPlan>("/api/sprint", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patchTask: (id: number, payload: { completed?: boolean; title?: string; owner?: string }) =>
    request<SprintTask>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Submission
  getSubmission: (ideaId: number) =>
    request<SubmissionKit | null>(`/api/submission/${ideaId}`),
  generateSubmission: (idea_id: number) =>
    request<SubmissionKit>("/api/submission/generate", {
      method: "POST",
      body: JSON.stringify({ idea_id }),
    }),
  submissionDownloadUrl: (ideaId: number, file?: string) =>
    `${API_BASE}/api/submission/${ideaId}/download${file ? `?file=${encodeURIComponent(file)}` : ""}`,

  // Scaffold
  createScaffold: (payload: {
    idea_id?: number;
    project_name?: string;
    one_liner?: string;
    tech?: string[];
  }) =>
    request<ScaffoldResult>("/api/scaffold", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Chat history
  listChatMessages: () => request<ChatMessage[]>("/api/chat/history"),
  clearChatMessages: () =>
    request<void>("/api/chat/history", { method: "DELETE" }),
};

export interface StreamChatCallbacks {
  onToolStart?: (tool: { name: string; args: Record<string, unknown> }) => void;
  onToolEnd?: (tool: ToolLogEntry) => void;
  onToken?: (text: string) => void;
  onDone?: (payload: { content: string; tool_logs: ToolLogEntry[] }) => void;
  onError?: (message: string) => void;
}

export async function streamChat(
  payload: { message: string; allow_code_run: boolean },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    let msg = `Chat failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) msg = String(err.detail);
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }

  if (!res.body) {
    throw new ApiError("Streaming response unavailable", 500);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n");
      let eventType = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataStr += line.slice(5).trim();
        }
      }
      if (!dataStr) continue;
      try {
        const parsed = JSON.parse(dataStr);
        if (eventType === "tool_start") {
          callbacks.onToolStart?.(parsed);
        } else if (eventType === "tool_end") {
          callbacks.onToolEnd?.(parsed);
        } else if (eventType === "token") {
          callbacks.onToken?.(parsed.text ?? "");
        } else if (eventType === "done") {
          callbacks.onDone?.(parsed);
        } else if (eventType === "error") {
          callbacks.onError?.(parsed.message ?? "Unknown error");
        }
      } catch {
        // skip malformed SSE frame
      }
    }
  }
}
