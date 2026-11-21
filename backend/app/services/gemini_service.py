from __future__ import annotations

import re
from typing import TypeVar
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import KEY_MISSING_MESSAGE, get_settings

T = TypeVar("T", bound=BaseModel)


class GeminiNotConfiguredError(RuntimeError):
    """Raised when GEMINI_API_KEY is missing in .env."""


class GeminiAPIError(RuntimeError):
    """Raised when Gemini fails to return valid content or encounters an API error."""


def get_gemini_client() -> tuple[genai.Client, str]:
    settings = get_settings()
    if not settings.gemini_configured:
        raise GeminiNotConfiguredError(KEY_MISSING_MESSAGE)
    client = genai.Client(api_key=settings.gemini_api_key)
    return client, settings.gemini_model


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _call_json_model(
    client: genai.Client,
    model: str,
    prompt: str,
    schema: type[T],
    system_instruction: str,
) -> str:
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.2,
        ),
    )
    return response.text or ""


def generate_structured(
    prompt: str,
    schema: type[T],
    system_instruction: str,
) -> T:
    """Call Gemini with Pydantic JSON schema validation; retry once on invalid JSON/validation error."""
    client, model = get_gemini_client()

    last_error: Exception | None = None
    last_raw = ""

    for attempt in range(2):
        current_prompt = prompt
        if attempt == 1:
            current_prompt = (
                f"{prompt}\n\n"
                f"IMPORTANT: Your previous JSON response failed schema validation with this error:\n"
                f"{last_error}\n"
                f"Previous output was:\n{last_raw[:2000]}\n\n"
                f"Return ONLY valid JSON strictly conforming to the required schema."
            )

        try:
            raw_text = _call_json_model(client, model, current_prompt, schema, system_instruction)
        except Exception as exc:
            raise GeminiAPIError(f"Gemini request failed: {exc}") from exc

        last_raw = raw_text
        cleaned = _strip_json_fences(raw_text)
        try:
            return schema.model_validate_json(cleaned)
        except (ValidationError, ValueError) as exc:
            last_error = exc

    raise GeminiAPIError(
        f"Gemini returned invalid structured JSON after retrying once: {last_error}"
    )
