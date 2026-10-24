import os
import subprocess
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class DeploymentTests(unittest.TestCase):
    def run_python(self, args, extra=None):
        env = dict(os.environ)
        env.update(VERCEL="1", DATABASE_URL="", TWELVE_DATA_API_KEY="", GOLD_API_KEY="", CRON_SECRET="")
        env.update(extra or {})
        return subprocess.run([sys.executable, "-B", *args], cwd=PROJECT_ROOT, env=env,
                              capture_output=True, text=True, timeout=30)

    def test_vercel_can_import_and_serve_ui_without_database_or_local_env(self):
        result = self.run_python(["-c", '''
import os
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles
import app
import settings
assert settings.IS_VERCEL
assert not settings.SCHEDULER_ENABLED
assert os.environ["GOLD_API_KEY"] == ""
with tempfile.TemporaryDirectory() as directory:
    Path(directory, "index.html").write_text("<html>Investment app</html>", encoding="utf-8")
    app.app.routes[-1].app = StaticFiles(directory=directory, html=True)
    with TestClient(app.app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/api/").status_code == 200
        for path in ("/api/investments", "/api/market-prices", "/api/health", "/api/market"):
            response = client.get(path)
            assert response.status_code == 503, (path, response.text)
            assert "localhost" not in response.text
'''])
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_configuration_check_reports_missing_values_without_network(self):
        result = self.run_python(["scripts/check_deployment.py"])
        self.assertEqual(result.returncode, 1)
        for key in ("DATABASE_URL", "TWELVE_DATA_API_KEY", "GOLD_API_KEY", "CRON_SECRET"):
            self.assertIn(key, result.stdout)

    def test_configuration_check_accepts_hosted_settings_without_printing_secrets(self):
        result = self.run_python(["scripts/check_deployment.py"], {
            "DATABASE_URL": "postgresql://testuser:private-db-password@db.example.com/app",
            "TWELVE_DATA_API_KEY": "private-twelve-key",
            "GOLD_API_KEY": "private-gold-key",
            "CRON_SECRET": "private-cron-secret-32-characters",
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PASS:", result.stdout)
        self.assertNotIn("private", result.stdout + result.stderr)
