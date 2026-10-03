"""Daily job lifecycle; PostgreSQL elects one scheduler owner per database."""

import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from settings import MARKET_SAVE_HOUR, MARKET_SAVE_MINUTE, TOKYO

logger = logging.getLogger(__name__)
SCHEDULER_LOCK_ID = 734018260


@asynccontextmanager
async def daily_scheduler(engine, job):
    connection = None
    scheduler = None
    owns_lock = False
    try:
        if engine.dialect.name == "postgresql":
            connection = engine.connect()
            owns_lock = bool(connection.execute(
                text("SELECT pg_try_advisory_lock(:lock_id)"),
                {"lock_id": SCHEDULER_LOCK_ID},
            ).scalar())
            connection.commit()
            if not owns_lock:
                connection.close()
                connection = None
                logger.info("Daily scheduler is already owned by another process")
                yield None
                return

        scheduler = AsyncIOScheduler(timezone=TOKYO)
        scheduler.add_job(
            job, "cron", hour=MARKET_SAVE_HOUR, minute=MARKET_SAVE_MINUTE,
            id="save-daily-market-price", replace_existing=True,
            max_instances=1, coalesce=True, misfire_grace_time=3600,
        )
        scheduler.start()
        logger.info("Daily market save scheduled at %02d:%02d Asia/Tokyo",
                    MARKET_SAVE_HOUR, MARKET_SAVE_MINUTE)
        yield scheduler
    finally:
        if scheduler is not None and scheduler.running:
            scheduler.shutdown(wait=False)
            # AsyncIOScheduler schedules shutdown on its loop.
            await asyncio.sleep(0)
        if connection is not None:
            try:
                if owns_lock:
                    connection.execute(text("SELECT pg_advisory_unlock(:lock_id)"),
                                       {"lock_id": SCHEDULER_LOCK_ID})
                    connection.commit()
            finally:
                connection.close()
