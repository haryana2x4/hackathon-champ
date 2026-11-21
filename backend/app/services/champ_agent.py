from __future__ import annotations

import json
from collections.abc import Generator
from typing import Any
from google.genai import types
from sqlalchemy.orm import Session

from app.models import BriefModel, ChatMessageModel, IdeaModel
from app.services.gemini_service import get_gemini_client
from app.tools.registry import execute_tool, get_tool_declarations

MAX_TOOL_CALLS_PER_MESSAGE = 6


def _sse_event(event_name: str, payload: dict[str, Any]) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _build_system_instruction(db: Session, allow_code_run: bool) -> str:
    latest_brief = db.query(BriefModel).order_by(BriefModel.id.desc()).first()
    locked_idea = db.query(IdeaModel).filter(IdeaModel.is_locked.is_(True)).order_by(IdeaModel.id.desc()).first()

    context_bits: list[str] = []
    if latest_brief:
        context_bits.append(f"Current hackathon brief: '{latest_brief.title}' (theme: {latest_brief.theme}).")
    if locked_idea:
        context_bits.append(
            f"Locked project idea: '{locked_idea.title}' — {locked_idea.one_liner} (tech: {locked_idea.tech_json})."
        )

    context_block = "\n".join(context_bits) if context_bits else "No brief or locked idea saved yet."

    return f"""You are Champ, a sharp, practical Jarvis-style AI co-pilot helping a student team win a hackathon.
Tone: clear, encouraging, concise, plain English that a beginner can immediately act on.
Available tools:
- `fetch_url(url)`: inspect public web pages the user explicitly asks about.
- `github_repo(owner, repo, path?)`: read public GitHub repos, READMEs, trees, or files.
- `search_free_apis(query)`: search the local public-apis directory for free APIs.
- `find_place(query)`: geocode a city/place via Nominatim.
- `create_file(path, content)`: save notes, specs, or code strictly inside `workspace_out/`.
- `run_python(code)`: execute Python snippets ONLY when allow_code_run is ON (currently: {"ON" if allow_code_run else "OFF"}).

SAFETY & TOOL RULES:
- Use your tools directly when a user asks to inspect a GitHub repo, fetch a URL, find a free API, geocode a place, create a file, or run Python — even if a safety policy may block the tool, call the tool so Mission Control logs the exact check and then explain the block clearly.
- Maximum {MAX_TOOL_CALLS_PER_MESSAGE} tool calls per message.
- Never fabricate tool outputs, URLs, or API capabilities.

Current workspace context:
{context_block}
"""


def _load_recent_history(db: Session, limit: int = 10) -> list[types.Content]:
    rows = (
        db.query(ChatMessageModel)
        .order_by(ChatMessageModel.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    contents: list[types.Content] = []
    for row in rows:
        role = "user" if row.role == "user" else "model"
        if row.content.strip():
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=row.content)]))
    return contents


def stream_champ_response(
    message: str,
    allow_code_run: bool,
    db: Session,
) -> Generator[str, None, None]:
    """Stream Champ's response over SSE with multi-turn Gemini function calling (max 6 calls)."""
    client, model = get_gemini_client()

    history = _load_recent_history(db)

    # Save user message immediately
    user_row = ChatMessageModel(role="user", content=message, tool_logs_json="[]")
    db.add(user_row)
    db.commit()

    contents: list[types.Content] = [
        *history,
        types.Content(role="user", parts=[types.Part.from_text(text=message)]),
    ]

    config = types.GenerateContentConfig(
        system_instruction=_build_system_instruction(db, allow_code_run),
        tools=[types.Tool(function_declarations=get_tool_declarations())],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.4,
    )

    tool_logs: list[dict[str, Any]] = []
    tool_calls_used = 0
    full_reply_chunks: list[str] = []

    try:
        # Allow up to MAX_TOOL_CALLS_PER_MESSAGE + 2 reasoning rounds
        for _round in range(MAX_TOOL_CALLS_PER_MESSAGE + 2):
            stream = client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config,
            )

            model_parts: list[types.Part] = []
            round_function_calls: list[types.FunctionCall] = []

            for chunk in stream:
                candidates = getattr(chunk, "candidates", None) or []
                if not candidates:
                    continue
                content_obj = getattr(candidates[0], "content", None)
                parts = getattr(content_obj, "parts", None) or []
                for part in parts:
                    # Preserve original part (including any thought_signature) for multi-turn replay
                    model_parts.append(part)
                    fc = getattr(part, "function_call", None)
                    if fc is not None and getattr(fc, "name", None):
                        round_function_calls.append(fc)
                    else:
                        text = getattr(part, "text", None)
                        is_thought = getattr(part, "thought", False)
                        if text and not is_thought:
                            full_reply_chunks.append(text)
                            yield _sse_event("token", {"text": text})

            if not round_function_calls:
                break

            # Append model turn verbatim before executing tool calls
            contents.append(types.Content(role="model", parts=model_parts))

            response_parts: list[types.Part] = []
            for fc in round_function_calls:
                tool_name = fc.name or ""
                tool_args = dict(fc.args) if fc.args else {}

                if tool_calls_used >= MAX_TOOL_CALLS_PER_MESSAGE:
                    limit_log = {
                        "name": tool_name,
                        "args": tool_args,
                        "duration_ms": 0,
                        "status": "blocked",
                        "summary": f"Tool call cap ({MAX_TOOL_CALLS_PER_MESSAGE}) reached for this message.",
                    }
                    tool_logs.append(limit_log)
                    yield _sse_event("tool_end", limit_log)
                    response_parts.append(
                        types.Part.from_function_response(
                            name=tool_name,
                            response={
                                "ok": False,
                                "error": f"Tool call limit ({MAX_TOOL_CALLS_PER_MESSAGE}) reached. Summarize your answer now.",
                            },
                        )
                    )
                    continue

                tool_calls_used += 1
                yield _sse_event("tool_start", {"name": tool_name, "args": tool_args})

                tool_payload, log_entry = execute_tool(
                    tool_name,
                    tool_args,
                    db=db,
                    allow_code_run=allow_code_run,
                )
                tool_logs.append(log_entry)
                yield _sse_event("tool_end", log_entry)

                response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response=tool_payload,
                    )
                )

            contents.append(types.Content(role="user", parts=response_parts))

        final_text = "".join(full_reply_chunks).strip()
        if not final_text:
            final_text = "Completed the requested tool checks. Review the Mission Control log for details."
            yield _sse_event("token", {"text": final_text})

        assistant_row = ChatMessageModel(
            role="assistant",
            content=final_text,
            tool_logs_json=json.dumps(tool_logs),
        )
        db.add(assistant_row)
        db.commit()

        yield _sse_event("done", {"content": final_text, "tool_logs": tool_logs})

    except Exception as exc:
        err_msg = f"Champ encountered an error: {exc}"
        yield _sse_event("error", {"message": err_msg})
