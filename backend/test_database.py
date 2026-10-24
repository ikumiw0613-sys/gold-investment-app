import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import OperationalError

import database


class DatabaseTests(unittest.TestCase):
    def test_hosted_urls_use_installed_driver_tls_and_connection_timeout(self):
        for scheme in ("postgres", "postgresql", "postgresql+psycopg2"):
            url = database.database_url(f"{scheme}://user:secret@db.example.com/app", production=True)
            self.assertEqual(url.drivername, "postgresql+psycopg2")
            self.assertEqual(url.query["sslmode"], "require")
            self.assertEqual(url.query["connect_timeout"], "10")

    def test_explicit_verification_and_timeout_are_preserved(self):
        url = database.database_url("postgresql://user:secret@db.example.com/app?sslmode=verify-full&connect_timeout=20", production=True)
        self.assertEqual(url.query["sslmode"], "verify-full")
        self.assertEqual(url.query["connect_timeout"], "20")
        insecure = database.database_url("postgresql://user:secret@db.example.com/app?sslmode=disable", production=True)
        self.assertEqual(insecure.query["sslmode"], "require")

    def test_hosted_settings_reject_local_and_ephemeral_database_urls(self):
        for value in (None, "", "not-a-url-secret", "sqlite://", "postgresql:///app",
                      "postgresql://user:secret@db.example.com:invalid/app",
                      "postgresql://localhost/app", "postgresql://127.0.0.2/app",
                      "postgresql://[::1]/app", "postgresql://0.0.0.0/app"):
            with self.subTest(value=value):
                with self.assertRaises(database.DatabaseConfigurationError) as error:
                    database.database_url(value, production=True)
                self.assertNotIn("secret", str(error.exception))

    def test_local_development_still_allows_local_database(self):
        self.assertEqual(database.database_url("postgresql://localhost/app").host, "localhost")
        self.assertEqual(database.database_url("sqlite://").drivername, "sqlite")

    def test_first_use_creates_tables_and_reuses_engine(self):
        from sqlmodel import Session, select
        from models import InvestmentRecord

        with tempfile.TemporaryDirectory() as directory:
            url = f"sqlite:///{Path(directory) / 'database.sqlite3'}"
            with patch.object(database, "_engine", None), patch.object(database.settings, "IS_VERCEL", False), patch.dict(os.environ, {"DATABASE_URL": url}):
                engine = database.get_engine()
                try:
                    self.assertIs(engine, database.get_engine())
                    with Session(engine) as session:
                        self.assertEqual(session.exec(select(InvestmentRecord)).all(), [])
                finally:
                    engine.dispose()

    def test_failed_initialization_disposes_connection_and_allows_retry(self):
        first, second = MagicMock(), MagicMock()
        with patch.object(database, "_engine", None), patch.object(database.settings, "IS_VERCEL", True), patch.dict(os.environ, {"DATABASE_URL": "postgresql://user:secret@db.example.com/app"}), patch.object(database, "create_engine", side_effect=[first, second]) as create, patch.object(database.SQLModel.metadata, "create_all", side_effect=[OperationalError("private", {}, Exception("secret")), None]):
            with self.assertRaises(OperationalError):
                database.get_engine()
            first.dispose.assert_called_once()
            self.assertIsNone(database._engine)
            self.assertIs(database.get_engine(), second)
            self.assertIs(create.call_args.kwargs["poolclass"], database.NullPool)
