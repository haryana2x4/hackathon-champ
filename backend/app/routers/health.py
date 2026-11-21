from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        gemini_configured=settings.gemini_configured,
        gemini_model=settings.gemini_model,
    )
