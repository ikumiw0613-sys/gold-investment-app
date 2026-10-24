import os

from sqlmodel import create_engine
from sqlalchemy.pool import NullPool
import settings  # Load the project's .env before reading DATABASE_URL.

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

# Let the hosted PostgreSQL pooler manage connections across function instances.
engine = create_engine(DATABASE_URL, pool_pre_ping=True,
                       **({"poolclass": NullPool} if settings.IS_VERCEL else {}))
