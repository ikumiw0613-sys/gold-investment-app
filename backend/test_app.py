"""API/lifecycle checks using a disposable SQLite DB and mocked market providers."""

import asyncio
import importlib.util
import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
from sqlalchemy.exc import OperationalError

# Never use the developer's PostgreSQL connection in this test suite.
with patch.dict(os.environ, {"DATABASE_URL": "sqlite://", "SCHEDULER_ENABLED": "false"}):
    import main


class AppTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.engine = create_engine(f"sqlite:///{Path(directory.name) / 'test.sqlite3'}",
                                    connect_args={"check_same_thread": False})
        self.addCleanup(self.engine.dispose)
        SQLModel.metadata.create_all(self.engine)
        engine_patch = patch.object(main, "get_engine", return_value=self.engine)
        engine_patch.start()
        self.addCleanup(engine_patch.stop)
        scheduler_patch = patch.object(main, "SCHEDULER_ENABLED", False)
        scheduler_patch.start()
        self.addCleanup(scheduler_patch.stop)
        vercel_patch = patch.object(main, "IS_VERCEL", False)
        vercel_patch.start()
        self.addCleanup(vercel_patch.stop)
        self.series = AsyncMock(side_effect=self.mock_series)
        self.gold = AsyncMock(return_value={"price": 2700, "prev_close_price": 2690,
                                           "change": 10, "change_percent": 0.37})
        for name, mock in [("series", self.series), ("gold", self.gold)]:
            provider_patch = patch.object(main.market_data, name, mock)
            provider_patch.start()
            self.addCleanup(provider_patch.stop)

    async def mock_series(self, symbol):
        await asyncio.sleep(0)
        return {"values": [{"datetime": datetime.now(main.TOKYO).date().isoformat(),
                            "close": "400" if symbol == "GLD" else "150"}]}

    def test_market_and_history_routes(self):
        with TestClient(main.app) as client:
            response = client.get("/market")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["gldPrice"], 400)
            self.assertEqual(response.json()["usdJpy"], 150)
            for period in ["7d", "1m", "3m", "1y"]:
                history = client.get(f"/market/gld/history?period={period}")
                self.assertEqual(history.status_code, 200)
                self.assertEqual(history.json()[0]["price"], 400)
            self.assertEqual(client.get("/db-check").status_code, 404)

    def test_investment_survives_app_restart(self):
        record = {"id": "v1-test", "date": "2026-10-03", "added_points": 500,
                  "fee_points": 5, "invested_points": 495, "gld_price": 400,
                  "usd_jpy": 150, "approximate_price": 60000, "virtual_amount": 0.00825}
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/investments").json(), [])
            self.assertEqual(client.post("/investments", json=record).status_code, 200)
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/investments").json(), [record])

    def test_daily_saves_return_one_row(self):
        with TestClient(main.app) as client:
            first = client.post("/market-prices")
            second = client.post("/market-prices")
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json(), second.json())
            self.assertEqual(len(client.get("/market-prices").json()), 1)
            self.assertEqual(first.json()["date"], datetime.now(main.TOKYO).date().isoformat())
            self.assertEqual(self.gold.await_count, 1)

    def test_cron_requires_configured_secret_and_is_idempotent(self):
        with TestClient(main.app) as client:
            with patch.dict(os.environ, {"CRON_SECRET": ""}):
                self.assertEqual(client.get("/cron/market-prices").status_code, 503)
            with patch.dict(os.environ, {"CRON_SECRET": "test-cron-secret"}):
                for headers in [{}, {"Authorization": "Bearer incorrect"}]:
                    self.assertEqual(client.get("/cron/market-prices", headers=headers).status_code, 401)
                self.gold.assert_not_awaited()
                headers = {"Authorization": "Bearer test-cron-secret"}
                first = client.get("/cron/market-prices", headers=headers)
                second = client.get("/cron/market-prices", headers=headers)
                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.json(), second.json())
                self.assertEqual(len(client.get("/market-prices").json()), 1)
                self.assertEqual(self.gold.await_count, 1)

    def test_vercel_entrypoint_mounts_api_and_runs_database_lifespan(self):
        spec = importlib.util.spec_from_file_location("vercel_entrypoint", Path(__file__).resolve().parents[1] / "app.py")
        entrypoint = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(entrypoint)
        with TestClient(entrypoint.app) as client:
            self.assertEqual(client.get("/api/").json(), {"message": "Gold Investment API"})
            self.assertEqual(client.get("/api/investments").json(), [])
            self.assertEqual(client.get("/api/market").json()["gldPrice"], 400)
            self.assertEqual(client.get("/api/does-not-exist").status_code, 404)
            self.assertEqual(client.get("/api/openapi.json").json()["servers"], [{"url": "/api"}])

    def test_invalid_investment_is_rejected_before_database_write(self):
        with TestClient(main.app) as client:
            response = client.post("/investments", json={"id": "invalid", "date": "not-a-date"})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(client.get("/investments").json(), [])

    def test_health_checks_database(self):
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/health").json(), {"status": "ok"})

    def test_database_connection_errors_return_service_unavailable_without_credentials(self):
        with TestClient(main.app) as client:
            with patch.object(main, "get_engine", side_effect=OperationalError("private-database", {}, Exception("secret-password"))):
                for path in ("/investments", "/market-prices", "/health"):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 503)
                    self.assertNotIn("secret-password", response.text)
                    self.assertNotIn("private-database", response.text)

    def test_concurrent_daily_saves_return_same_row(self):
        with TestClient(main.app):
            async def save_both():
                return await asyncio.gather(main.save_today_market_price(), main.save_today_market_price())
            first, second = asyncio.run(save_both())
            self.assertEqual(first.id, second.id)

    def test_cors_allows_configured_origin_only(self):
        with TestClient(main.app) as client:
            for origin, status in [(main.CORS_ORIGINS[0], 200), ("https://untrusted.invalid", 400)]:
                response = client.options("/investments", headers={"Origin": origin,
                    "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
                self.assertEqual(response.status_code, status)

    def test_scheduler_registers_once_on_each_start_and_stops(self):
        schedulers = []
        with patch.object(main, "SCHEDULER_ENABLED", True):
            for _ in range(2):
                with TestClient(main.app):
                    scheduler = main.app.state.scheduler
                    self.assertTrue(scheduler.running)
                    self.assertEqual([job.id for job in scheduler.get_jobs()], ["save-daily-market-price"])
                    self.assertEqual(str(scheduler.timezone), "Asia/Tokyo")
                    schedulers.append(scheduler)
                self.assertFalse(scheduler.running)
                self.assertIsNone(main.app.state.scheduler)
        self.assertIsNot(schedulers[0], schedulers[1])
