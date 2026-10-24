"""Vercel entrypoint: the built UI and the API share one origin."""

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Preserve the backend's standalone `uvicorn main:app` development command.
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from main import app as api_app, lifespan  # noqa: E402

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api_app)
app.mount("/", StaticFiles(directory=str(PROJECT_ROOT / "frontend" / "dist"),
                          html=True, check_dir=False), name="frontend")
