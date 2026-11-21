from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import briefs, chat, hackathons, health, ideas, scaffold, sprint


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Hackathon Champ API",
        version="1.0.0",
        description="Backend API for Hackathon Champ — Mission Control & Champ AI Agent.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(briefs.router)
    app.include_router(ideas.router)
    app.include_router(hackathons.router)
    app.include_router(sprint.router)
    app.include_router(scaffold.router)
    app.include_router(chat.router)
    return app


app = create_app()
