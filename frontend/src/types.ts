export type PageId =
  | "brief"
  | "ideas"
  | "champ"
  | "map"
  | "sprint"
  | "submission"
  | "scaffold";

export interface HealthResponse {
  status: string;
  gemini_configured: boolean;
  gemini_model: string;
}

export interface DeadlineItem {
  label: string;
  iso: string | null;
}

export interface JudgingCriterion {
  name: string;
  weight: number | null;
  description: string;
}

export interface Brief {
  id: number;
  title: string;
  theme: string;
  summary: string;
  deadlines: DeadlineItem[];
  prizes: string[];
  sponsor_tech: string[];
  rules: string[];
  judging_criteria: JudgingCriterion[];
  source: string;
  rubric_label: string;
  effective_rubric: JudgingCriterion[];
  created_at: string;
}

export interface IdeaScore {
  criterion: string;
  score: number;
  reason: string;
}

export interface Idea {
  id: number;
  brief_id: number;
  title: string;
  one_liner: string;
  problem: string;
  solution: string;
  tech: string[];
  build_hours: number;
  risks: string[];
  scores: IdeaScore[];
  is_locked: boolean;
  average_score: number;
  created_at: string;
}

export interface Hackathon {
  id: number;
  name: string;
  link: string;
  date: string;
  location: string;
  is_online: boolean;
  lat: number | null;
  lon: number | null;
  display_name: string;
  created_at: string;
}

export interface SprintTask {
  id: number;
  sprint_id: string;
  deadline_iso: string;
  team_size: number;
  phase: string;
  title: string;
  owner: string;
  duration_minutes: number;
  duration_hours: number;
  start_offset_minutes: number;
  is_feature_freeze: boolean;
  completed: boolean;
  order_index: number;
}

export interface PhaseSummary {
  phase: string;
  percent: number;
  minutes: number;
  hours: number;
  cumulative_percent: number;
  is_feature_freeze_end: boolean;
}

export interface SprintPlan {
  sprint_id: string;
  deadline_iso: string;
  team_size: number;
  total_minutes: number;
  total_hours: number;
  feature_freeze_minutes: number;
  feature_freeze_iso: string;
  phases: PhaseSummary[];
  tasks: SprintTask[];
}

export interface SubmissionKit {
  idea_id: number;
  idea_title: string;
  inspiration: string;
  what_it_does: string;
  how_we_built_it: string;
  challenges: string;
  accomplishments: string;
  whats_next: string;
  built_with: string[];
  readme_md: string;
  pitch_2min_md: string;
  demo_checklist_md: string;
  pitch_word_count: number;
}

export interface ScaffoldResult {
  path: string;
  slug: string;
  files: string[];
}

export interface ToolLogEntry {
  name: string;
  args: Record<string, unknown>;
  duration_ms: number;
  status: string;
  summary: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_logs: ToolLogEntry[];
  created_at: string;
}
