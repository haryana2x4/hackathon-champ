from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


# --- Health ---
class HealthResponse(BaseModel):
    status: str = "ok"
    gemini_configured: bool
    gemini_model: str


# --- Briefs ---
class DeadlineItem(BaseModel):
    label: str
    iso: str | None = None


class JudgingCriterion(BaseModel):
    name: str
    weight: float | None = None
    description: str


class BriefPayload(BaseModel):
    title: str
    theme: str
    summary: str
    deadlines: list[DeadlineItem] = Field(default_factory=list)
    prizes: list[str] = Field(default_factory=list)
    sponsor_tech: list[str] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list)
    judging_criteria: list[JudgingCriterion] = Field(default_factory=list)
    source: str


class BriefAnalyzeRequest(BaseModel):
    url: str | None = Field(default=None, max_length=2048)
    text: str | None = Field(default=None, max_length=200_000)

    @model_validator(mode="after")
    def validate_one_present(self) -> "BriefAnalyzeRequest":
        has_url = bool(self.url and self.url.strip())
        has_text = bool(self.text and self.text.strip())
        if not has_url and not has_text:
            raise ValueError("Provide either a hackathon URL or pasted brief text.")
        return self


class BriefResponse(BriefPayload):
    id: int
    rubric_label: str
    effective_rubric: list[JudgingCriterion]
    created_at: str


# --- Ideas ---
class IdeaScore(BaseModel):
    criterion: str
    score: int = Field(ge=1, le=5)
    reason: str


class IdeaPayload(BaseModel):
    title: str
    one_liner: str
    problem: str
    solution: str
    tech: list[str] = Field(default_factory=list)
    build_hours: float = Field(gt=0)
    risks: list[str] = Field(default_factory=list)
    scores: list[IdeaScore] = Field(default_factory=list)


class IdeasBatchPayload(BaseModel):
    ideas: list[IdeaPayload] = Field(min_length=3, max_length=3)


class IdeaGenerateRequest(BaseModel):
    brief_id: int = Field(gt=0)


class IdeaResponse(IdeaPayload):
    id: int
    brief_id: int
    is_locked: bool
    average_score: float
    created_at: str


# --- Hackathons / Map ---
class HackathonCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=250)
    link: str = Field(default="", max_length=500)
    date: str = Field(default="", max_length=100)
    location: str = Field(min_length=1, max_length=250)

    @field_validator("name", "link", "date", "location", mode="before")
    @classmethod
    def strip_strings(cls, v: Any) -> str:
        return str(v).strip() if v is not None else ""


class HackathonResponse(BaseModel):
    id: int
    name: str
    link: str
    date: str
    location: str
    is_online: bool
    lat: float | None = None
    lon: float | None = None
    display_name: str
    created_at: str


# --- Sprint / Tasks ---
class SprintCreateRequest(BaseModel):
    deadline_iso: str = Field(min_length=10, max_length=64)
    team_size: int = Field(ge=1, le=20)


class TaskResponse(BaseModel):
    id: int
    sprint_id: str
    deadline_iso: str
    team_size: int
    phase: str
    title: str
    owner: str
    duration_minutes: int
    duration_hours: float
    start_offset_minutes: int
    is_feature_freeze: bool
    completed: bool
    order_index: int


class PhaseSummary(BaseModel):
    phase: str
    percent: int
    minutes: int
    hours: float
    cumulative_percent: int
    is_feature_freeze_end: bool = False


class SprintResponse(BaseModel):
    sprint_id: str
    deadline_iso: str
    team_size: int
    total_minutes: int
    total_hours: float
    feature_freeze_minutes: int
    feature_freeze_iso: str
    phases: list[PhaseSummary]
    tasks: list[TaskResponse]


class TaskPatchRequest(BaseModel):
    completed: bool | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    owner: str | None = Field(default=None, min_length=1, max_length=120)


# --- Submission ---
class SubmissionGenerateRequest(BaseModel):
    idea_id: int = Field(gt=0)


class SubmissionPayload(BaseModel):
    inspiration: str
    what_it_does: str
    how_we_built_it: str
    challenges: str
    accomplishments: str
    whats_next: str
    built_with: list[str] = Field(default_factory=list)
    readme_md: str
    pitch_2min_md: str
    demo_checklist_md: str


class SubmissionResponse(SubmissionPayload):
    idea_id: int
    idea_title: str
    pitch_word_count: int


# --- Scaffold ---
class ScaffoldRequest(BaseModel):
    idea_id: int | None = Field(default=None, gt=0)
    project_name: str | None = Field(default=None, min_length=1, max_length=120)
    one_liner: str | None = Field(default=None, max_length=400)
    tech: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_source(self) -> "ScaffoldRequest":
        if self.idea_id is None and not (self.project_name and self.project_name.strip()):
            raise ValueError("Provide either idea_id or project_name.")
        return self


class ScaffoldResponse(BaseModel):
    path: str
    slug: str
    files: list[str]


# --- Chat ---
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    allow_code_run: bool = False


class ToolLogEntry(BaseModel):
    name: str
    args: dict[str, Any]
    duration_ms: int
    status: str
    summary: str = ""


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    tool_logs: list[ToolLogEntry] = Field(default_factory=list)
    created_at: str
