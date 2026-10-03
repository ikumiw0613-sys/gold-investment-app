import os

from sqlmodel import create_engine
import settings  # Load the project's .env before reading DATABASE_URL.

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
