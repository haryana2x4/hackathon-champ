from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.models import BriefModel
from app.schemas import (
    BriefAnalyzeRequest,
    BriefPayload,
    BriefResponse,
    DeadlineItem,
    JudgingCriterion,
)
from app.services.gemini_service import generate_structured
from app.tools.fetch_url import fetch_url

ORGANISER_RUBRIC_LABEL = "Organiser judging criteria"
DEFAULT_RUBRIC_LABEL = "Default rubric (not from organiser)"

DEFAULT_RUBRIC: list[JudgingCriterion] = [
    JudgingCriterion(
        name="Innovation",
        weight=None,
        description="Originality, creativity, and uniqueness of the concept.",
    ),
    JudgingCriterion(
        name="Technical depth",
        weight=None,
        description="Engineering execution, reliability, and smart use of technology.",
    ),
    JudgingCriterion(
        name="Impact",
        weight=None,
        description="Practical usefulness and real-world value for target users.",
    ),
    JudgingCriterion(
        name="Design/UX",
        weight=None,
        description="Clarity, polish, accessibility, and ease of use.",
    ),
    JudgingCriterion(
        name="Presentation",
        weight=None,
        description="Clear storytelling, live demo flow, and persuasive pitch.",
    ),
]

BRIEF_SYSTEM_INSTRUCTION = """You are Hackathon Champ's Brief Analyst.
Extract structured hackathon brief details strictly from the provided source text.
NON-NEGOTIABLE RULES:
1. NEVER invent, guess, or infer judging criteria. Only include entries in `judging_criteria` if the source text explicitly states judging or evaluation criteria. If none appear in the source text, return `judging_criteria` as an empty list [].
2. Keep criterion names faithful to the organiser's exact wording from the page. Include numeric percentage weights ONLY when explicitly stated; otherwise set weight to null.
3. Extract deadlines (with ISO 8601 string if clearly stated, else null), prizes, sponsor technologies/APIs/tracks, and rules only from the provided content.
4. Keep the summary clear, beginner-friendly, and concise (2-4 sentences).
"""


def serialize_brief(row: BriefModel) -> BriefResponse:
    deadlines = [DeadlineItem(**d) for d in json.loads(row.deadlines_json or "[]")]
    prizes = json.loads(row.prizes_json or "[]")
    sponsor_tech = json.loads(row.sponsor_tech_json or "[]")
    rules = json.loads(row.rules_json or "[]")
    criteria = [JudgingCriterion(**c) for c in json.loads(row.judging_criteria_json or "[]")]

    has_criteria = len(criteria) > 0
    return BriefResponse(
        id=row.id,
        title=row.title,
        theme=row.theme,
        summary=row.summary,
        deadlines=deadlines,
        prizes=prizes,
        sponsor_tech=sponsor_tech,
        rules=rules,
        judging_criteria=criteria,
        source=row.source,
        rubric_label=ORGANISER_RUBRIC_LABEL if has_criteria else DEFAULT_RUBRIC_LABEL,
        effective_rubric=criteria if has_criteria else DEFAULT_RUBRIC,
        created_at=row.created_at.isoformat(),
    )


def analyze_brief(payload: BriefAnalyzeRequest, db: Session) -> BriefResponse:
    source_label = "pasted text"
    content_text = (payload.text or "").strip()

    if payload.url and payload.url.strip():
        fetched = fetch_url(payload.url.strip())
        source_label = fetched["url"]
        fetched_text = fetched["text"]
        if content_text:
            content_text = f"Page URL: {source_label}\nPage Title: {fetched['title']}\n\n{fetched_text}\n\nAdditional Notes:\n{content_text}"
        else:
            content_text = f"Page URL: {source_label}\nPage Title: {fetched['title']}\n\n{fetched_text}"

    prompt = (
        f"Source: {source_label}\n\n"
        f"Analyze the following hackathon brief content and return the structured JSON.\n"
        f"Remember: set `source` to {json.dumps(source_label)}. "
        f"NEVER invent judging criteria — return [] if none are explicitly mentioned.\n\n"
        f"--- CONTENT START ---\n{content_text[:28000]}\n--- CONTENT END ---"
    )

    parsed: BriefPayload = generate_structured(
        prompt=prompt,
        schema=BriefPayload,
        system_instruction=BRIEF_SYSTEM_INSTRUCTION,
    )

    row = BriefModel(
        title=parsed.title.strip() or "Untitled Hackathon",
        theme=parsed.theme.strip(),
        summary=parsed.summary.strip(),
        deadlines_json=json.dumps([d.model_dump() for d in parsed.deadlines]),
        prizes_json=json.dumps(parsed.prizes),
        sponsor_tech_json=json.dumps(parsed.sponsor_tech),
        rules_json=json.dumps(parsed.rules),
        judging_criteria_json=json.dumps([c.model_dump() for c in parsed.judging_criteria]),
        source=source_label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_brief(row)
