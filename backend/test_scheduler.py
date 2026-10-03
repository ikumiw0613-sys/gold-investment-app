import unittest
from unittest.mock import MagicMock

from scheduler import daily_scheduler


class SchedulerLockTests(unittest.IsolatedAsyncioTestCase):
    def engine(self, acquired):
        engine = MagicMock()
        engine.dialect.name = "postgresql"
        engine.connect.return_value.execute.return_value.scalar.return_value = acquired
        return engine

    async def test_non_owner_does_not_start_scheduler(self):
        engine = self.engine(False)
        async with daily_scheduler(engine, self.noop) as scheduler:
            self.assertIsNone(scheduler)
        connection = engine.connect.return_value
        self.assertEqual(connection.execute.call_count, 1)
        connection.close.assert_called_once()

    async def test_owner_stops_and_releases_lock_even_on_failure(self):
        engine = self.engine(True)
        with self.assertRaises(RuntimeError):
            async with daily_scheduler(engine, self.noop) as scheduler:
                self.assertTrue(scheduler.running)
                raise RuntimeError("test shutdown")
        self.assertFalse(scheduler.running)
        connection = engine.connect.return_value
        self.assertEqual(connection.execute.call_count, 2)
        self.assertIn("pg_advisory_unlock", str(connection.execute.call_args.args[0]))
        connection.close.assert_called_once()

    async def noop(self):
        pass
