from __future__ import annotations

import io
import json
import zipfile
from sqlalchemy.orm import Session

from app.models import BriefModel, IdeaModel
from app.schemas import SubmissionPayload, SubmissionResponse
from app.services.gemini_service import generate_structured
from app.services.scaffold_service import slugify

SUBMISSION_SYSTEM_INSTRUCTION = """You are Hackathon Champ's Devpost & Pitch Writer.
Create a complete, honest, high-impact hackathon submission kit for the locked project idea.
REQUIREMENTS:
1. Write all 7 Devpost sections clearly and concretely:
   - `inspiration`
   - `what_it_does`
   - `how_we_built_it`
   - `challenges`
   - `accomplishments`
   - `whats_next`
   - `built_with` (list of exact frameworks, languages, APIs, and sponsor tech)
2. Write `readme_md`: a clean, developer-ready GitHub README.md in Markdown (overview, features, architecture, local setup, team/credits).
3. Write `pitch_2min_md`: a spoken 2-minute live pitch script in Markdown targeting ~300 words (strictly between 260 and 340 words), structured into Hook (20s), Problem (25s), Live Demo Walk-Through (45s), Tech & Impact (20s), Close (10s).
4. Write `demo_checklist_md`: a crisp pre-demo checklist in Markdown (`- [ ] ...`) covering environment, backup video, API keys, judge Q&A prep, and submission verification.
5. Never claim fake metrics or fabricated awards; frame accomplishments honestly around what the team built.
"""


def _count_words(text: str) -> int:
    return len([w for w in text.split() if w.strip()])


def serialize_submission(idea: IdeaModel) -> SubmissionResponse | None:
    if not idea.submission_json:
        return None
    payload = SubmissionPayload.model_validate_json(idea.submission_json)
    return SubmissionResponse(
        idea_id=idea.id,
        idea_title=idea.title,
        pitch_word_count=_count_words(payload.pitch_2min_md),
        **payload.model_dump(),
    )


def format_devpost_markdown(sub: SubmissionResponse) -> str:
    built = ", ".join(sub.built_with) if sub.built_with else "FastAPI, React"
    return f"""# {sub.idea_title} — Devpost Submission

## Inspiration
{sub.inspiration}

## What it does
{sub.what_it_does}

## How we built it
{sub.how_we_built_it}

## Challenges we ran into
{sub.challenges}

## Accomplishments that we're proud of
{sub.accomplishments}

## What's next for {sub.idea_title}
{sub.whats_next}

## Built With
{built}
"""


def generate_submission_kit(idea_id: int, db: Session) -> SubmissionResponse:
    idea = db.query(IdeaModel).filter(IdeaModel.id == idea_id).first()
    if not idea:
        raise LookupError(f"Idea {idea_id} not found.")

    brief = db.query(BriefModel).filter(BriefModel.id == idea.brief_id).first()
    brief_ctx = ""
    if brief:
        brief_ctx = (
            f"Hackathon: {brief.title}\n"
            f"Theme: {brief.theme}\n"
            f"Sponsor Tech: {brief.sponsor_tech_json}\n"
            f"Judging Criteria: {brief.judging_criteria_json}\n"
        )

    prompt = (
        f"{brief_ctx}\n"
        f"Project Idea Title: {idea.title}\n"
        f"One-Liner: {idea.one_liner}\n"
        f"Problem: {idea.problem}\n"
        f"Solution: {idea.solution}\n"
        f"Tech Stack: {idea.tech_json}\n"
        f"Build Hours Estimate: {idea.build_hours}\n"
        f"Risks: {idea.risks_json}\n\n"
        f"Generate the full Devpost submission JSON including `readme_md`, `pitch_2min_md` (~300 words), and `demo_checklist_md`."
    )

    parsed: SubmissionPayload = generate_structured(
        prompt=prompt,
        schema=SubmissionPayload,
        system_instruction=SUBMISSION_SYSTEM_INSTRUCTION,
    )

    idea.submission_json = parsed.model_dump_json()
    db.commit()
    db.refresh(idea)
    res = serialize_submission(idea)
    assert res is not None
    return res


def build_submission_download(
    idea_id: int,
    db: Session,
    file_key: str | None = None,
) -> tuple[bytes, str, str]:
    """Return (bytes, media_type, filename) for either the full ZIP bundle or one markdown file."""
    idea = db.query(IdeaModel).filter(IdeaModel.id == idea_id).first()
    if not idea:
        raise LookupError(f"Idea {idea_id} not found.")
    sub = serialize_submission(idea)
    if not sub:
        raise LookupError("Submission kit has not been generated yet for this idea.")

    slug = slugify(idea.title)
    devpost_md = format_devpost_markdown(sub)

    if file_key:
        mapping = {
            "readme": ("README.md", sub.readme_md),
            "pitch": ("pitch-2min.md", sub.pitch_2min_md),
            "checklist": ("demo-checklist.md", sub.demo_checklist_md),
            "devpost": ("DEVPOST_SUBMISSION.md", devpost_md),
        }
        if file_key not in mapping:
            raise ValueError("Unknown file parameter. Use readme, pitch, checklist, or devpost.")
        fname, content = mapping[file_key]
        return content.encode("utf-8"), "text/markdown; charset=utf-8", fname

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("DEVPOST_SUBMISSION.md", devpost_md)
        zf.writestr("README.md", sub.readme_md)
        zf.writestr("pitch-2min.md", sub.pitch_2min_md)
        zf.writestr("demo-checklist.md", sub.demo_checklist_md)

    return buf.getvalue(), "application/zip", f"{slug}-submission-kit.zip"
