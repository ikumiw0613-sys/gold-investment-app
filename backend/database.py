"""Initialize database connections only when a database operation is requested."""

import os
from ipaddress import ip_address
from threading import Lock

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel, create_engine

import settings


class DatabaseConfigurationError(ValueError):
    pass


def database_url(value, *, production=False):
    if not value or not value.strip():
        raise DatabaseConfigurationError("DATABASE_URL is not set")
    try:
        url = make_url(value.strip())
    except (ArgumentError, ValueError):
        raise DatabaseConfigurationError("DATABASE_URL is not a valid connection URL") from None
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg2")
    if production:
        if url.drivername != "postgresql+psycopg2":
            raise DatabaseConfigurationError("Vercel requires a hosted PostgreSQL DATABASE_URL")
        host = (url.host or "").lower().rstrip(".")
        local = not host or host == "localhost" or host.endswith(".localhost")
        try:
            address = ip_address(host)
            local = local or address.is_loopback or address.is_unspecified
        except ValueError:
            pass
        if local:
            raise DatabaseConfigurationError("DATABASE_URL must point to hosted PostgreSQL, not localhost")
        options = {}
        if not url.query.get("connect_timeout"):
            options["connect_timeout"] = "10"
        if not url.query.get("sslmode") or url.query.get("sslmode") in {"disable", "allow", "prefer"}:
            options["sslmode"] = "require"
        url = url.update_query_dict(options)
    return url


_engine = None
_engine_lock = Lock()


def get_engine():
    global _engine
    with _engine_lock:
        if _engine is None:
            url = database_url(os.getenv("DATABASE_URL"), production=settings.IS_VERCEL)
            candidate = create_engine(url, pool_pre_ping=True,
                                      **({"poolclass": NullPool} if settings.IS_VERCEL else {}))
            try:
                # Register models without connecting during module import/build analysis.
                import models  # noqa: F401
                SQLModel.metadata.create_all(candidate)
            except Exception:
                candidate.dispose()
                raise
            _engine = candidate
        return _engine
