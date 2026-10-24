"""Environment settings shared by API startup and the daily scheduler."""

import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

IS_VERCEL = os.getenv("VERCEL") == "1"
# Hosted deployments use only the environment configured on Vercel.
if not IS_VERCEL:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    # Keep existing backend/.env setups working in local development.
    load_dotenv(Path(__file__).resolve().parent / ".env")

TOKYO = ZoneInfo("Asia/Tokyo")
CORS_ORIGINS = [
    origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
] or ["http://localhost:5173", "http://127.0.0.1:5173"]
# Serverless instances cannot own a persistent background scheduler. Use Vercel Cron.
SCHEDULER_ENABLED = not IS_VERCEL and (os.getenv("SCHEDULER_ENABLED") or "true").lower() in {"true", "1", "yes"}
MARKET_SAVE_HOUR = int(os.getenv("MARKET_SAVE_HOUR") or "7")
MARKET_SAVE_MINUTE = int(os.getenv("MARKET_SAVE_MINUTE") or "10")
if not 0 <= MARKET_SAVE_HOUR <= 23 or not 0 <= MARKET_SAVE_MINUTE <= 59:
    raise ValueError("MARKET_SAVE_HOUR must be 0..23 and MARKET_SAVE_MINUTE must be 0..59")
