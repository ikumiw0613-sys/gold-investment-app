import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

from market_data import MarketData


class MarketDataTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = 0
        self.market = MarketData(clock=lambda: self.now)
        self.patch = patch("market_data.httpx.AsyncClient")
        client = self.patch.start().return_value.__aenter__.return_value
        self.addCleanup(self.patch.stop)
        self.get = client.get = AsyncMock(return_value=httpx.Response(
            200, json={"values": [{"datetime": "2026-09-28", "close": "377.91"}]},
            request=httpx.Request("GET", "https://example.com"),
        ))

    async def test_simultaneous_and_repeated_requests_share_snapshot(self):
        results = await asyncio.gather(*(self.market.series("GLD") for _ in range(10)))
        await self.market.series("GLD")
        self.assertEqual(self.get.await_count, 1)
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual(self.get.call_args.kwargs["params"]["outputsize"], 366)

    async def test_refresh_only_when_expired(self):
        await self.market.series("GLD")
        self.now = 3599
        await self.market.series("GLD")
        self.assertEqual(self.get.await_count, 1)
        self.now = 3600
        await self.market.series("GLD")
        self.assertEqual(self.get.await_count, 2)

    async def test_rate_limit_blocks_other_symbols_but_preserves_valid_cache(self):
        await self.market.series("GLD")
        self.get.return_value = httpx.Response(
            429, headers={"Retry-After": "7200"},
            request=httpx.Request("GET", "https://example.com?apikey=secret"),
        )
        for symbol in ("USD/JPY", "XAU/USD"):
            with self.assertRaises(HTTPException) as error:
                await self.market.series(symbol)
            self.assertEqual(error.exception.status_code, 503)
            self.assertNotIn("secret", str(error.exception))
        await self.market.series("GLD")
        self.assertEqual(self.get.await_count, 2)
        self.now = 3601
        with self.assertRaises(HTTPException):
            await self.market.series("USD/JPY")
        self.assertEqual(self.get.await_count, 2)

    async def test_error_json_is_not_cached_and_recovery_is_possible(self):
        success = self.get.return_value
        self.get.return_value = httpx.Response(
            200, json={"status": "error", "code": 429},
            request=httpx.Request("GET", "https://example.com"),
        )
        with self.assertRaises(HTTPException):
            await self.market.series("GLD")
        self.assertFalse(self.market.cache)
        self.get.return_value = success
        self.now = 3600
        await self.market.series("GLD")
        self.assertEqual(self.get.await_count, 2)


if __name__ == "__main__":
    unittest.main()
