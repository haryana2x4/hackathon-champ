from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.models import BriefModel, IdeaModel
from app.schemas import IdeaResponse, IdeasBatchPayload, IdeaScore
from app.services.brief_service import serialize_brief
from app.services.gemini_service import generate_structured

IDEAS_SYSTEM_INSTRUCTION = """You are Hackathon Champ's Winning Idea Strategist.
Generate EXACTLY 3 distinct, realistic, high-scoring hackathon project ideas for a student team based on the brief.
NON-NEGOTIABLE RULES:
1. Respect ALL sponsor technologies/APIs and ALL rules/constraints listed in the brief.
2. Each idea must be realistically buildable in a hackathon timeframe (concrete `build_hours` estimate).
3. Score every idea strictly from 1 to 5 on EVERY criterion in the provided rubric, with a clear, honest one-sentence reason per score.
4. Make the 3 ideas genuinely different angles (not minor variations of the same app).
"""


def serialize_idea(row: IdeaModel) -> IdeaResponse:
    tech = json.loads(row.tech_json or "[]")
    risks = json.loads(row.risks_json or "[]")
    scores = [IdeaScore(**s) for s in json.loads(row.scores_json or "[]")]
    avg = round(sum(s.score for s in scores) / len(scores), 2) if scores else 0.0
    return IdeaResponse(
        id=row.id,
        brief_id=row.brief_id,
        title=row.title,
        one_liner=row.one_liner,
        problem=row.problem,
        solution=row.solution,
        tech=tech,
        build_hours=row.build_hours,
        risks=risks,
        scores=scores,
        is_locked=row.is_locked,
        average_score=avg,
        created_at=row.created_at.isoformat(),
    )


def generate_ideas_for_brief(brief_id: int, db: Session) -> list[IdeaResponse]:
    brief_row = db.query(BriefModel).filter(BriefModel.id == brief_id).first()
    if not brief_row:
        raise LookupError(f"Brief {brief_id} not found.")

    brief = serialize_brief(brief_row)
    rubric_lines = "\n".join(
        f"- {c.name}" + (f" (weight: {c.weight}%)" if c.weight is not None else "") + f": {c.description}"
        for c in brief.effective_rubric
    )

    prompt = (
        f"Hackathon Title: {brief.title}\n"
        f"Theme: {brief.theme}\n"
        f"Summary: {brief.summary}\n"
        f"Sponsor Tech: {', '.join(brief.sponsor_tech) if brief.sponsor_tech else 'None specified'}\n"
        f"Rules: {'; '.join(brief.rules) if brief.rules else 'Standard hackathon rules'}\n"
        f"Prizes: {'; '.join(brief.prizes) if brief.prizes else 'Not specified'}\n\n"
        f"Scoring Rubric ({brief.rubric_label}):\n{rubric_lines}\n\n"
        f"Return JSON with an `ideas` array of EXACTLY 3 ideas. "
        f"Every idea's `scores` list must score EVERY criterion listed above from 1 to 5."
    )

    batch: IdeasBatchPayload = generate_structured(
        prompt=prompt,
        schema=IdeasBatchPayload,
        system_instruction=IDEAS_SYSTEM_INSTRUCTION,
    )

    saved: list[IdeaModel] = []
    for item in batch.ideas:
        row = IdeaModel(
            brief_id=brief_row.id,
            title=item.title.strip(),
            one_liner=item.one_liner.strip(),
            problem=item.problem.strip(),
            solution=item.solution.strip(),
            tech_json=json.dumps(item.tech),
            build_hours=item.build_hours,
            risks_json=json.dumps(item.risks),
            scores_json=json.dumps([s.model_dump() for s in item.scores]),
            is_locked=False,
        )
        db.add(row)
        saved.append(row)

    db.commit()
    for row in saved:
        db.refresh(row)

    responses = [serialize_idea(r) for r in saved]
    responses.sort(key=lambda x: x.average_score, reverse=True)
    return responses


def lock_idea(idea_id: int, db: Session) -> IdeaResponse:
    target = db.query(IdeaModel).filter(IdeaModel.id == idea_id).first()
    if not target:
        raise LookupError(f"Idea {idea_id} not found.")

    db.query(IdeaModel).update({IdeaModel.is_locked: False})
    target.is_locked = True
    db.commit()
    db.refresh(target)
    return serialize_idea(target)
