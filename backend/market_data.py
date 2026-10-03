"""Shared market snapshots. External requests occur at most hourly per dataset."""

import asyncio
import os
from time import monotonic

import httpx
from fastapi import HTTPException


class MarketData:
    def __init__(self, ttl=3600, clock=monotonic):
        self.ttl = ttl
        self.clock = clock
        self.cache = {}
        self.retry_after = {}
        self.failure_messages = {}
        self.lock = asyncio.Lock()

    async def fetch(self, key, provider, url, **kwargs):
        # A shared lock also coalesces simultaneous dashboard/chart requests.
        async with self.lock:
            now = self.clock()
            cached = self.cache.get(key)
            if cached and now < cached[0]:
                return cached[1]
            if now < self.retry_after.get(provider, 0):
                raise HTTPException(503, self.failure_messages[provider])
            rate_limited = False
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, **kwargs)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError("Invalid market response")
                rate_limited = str(data.get("code")) == "429"
                if provider == "twelve" and (
                    data.get("status") == "error" or not data.get("values")
                ):
                    raise ValueError("Invalid market response")
                if provider == "twelve":
                    for value in data["values"]:
                        float(value["close"])
                        if not isinstance(value["datetime"], str):
                            raise ValueError("Invalid market date")
                if provider == "gold":
                    for field in ("price", "prev_close_price", "change", "change_percent"):
                        float(data[field])
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                delay = 3600
                if isinstance(exc, httpx.HTTPStatusError):
                    rate_limited = exc.response.status_code == 429
                    try:
                        delay = max(delay, int(exc.response.headers.get("Retry-After", 0)))
                    except ValueError:
                        pass
                self.retry_after[provider] = self.clock() + delay
                if rate_limited:
                    message = "市場データの取得上限に達しました。時間をおいて再度お試しください。"
                elif isinstance(exc, httpx.RequestError):
                    message = "市場データの提供元に接続できませんでした。時間をおいて再度お試しください。"
                else:
                    message = "市場データの提供元から正しいデータを取得できませんでした。時間をおいて再度お試しください。"
                self.failure_messages[provider] = message
                # Do not expose external request URLs containing API keys.
                raise HTTPException(503, message) from None
            self.cache[key] = (self.clock() + self.ttl, data)
            return data

    async def series(self, symbol):
        # One GLD snapshot serves the latest price and every chart period.
        return await self.fetch(
            symbol, "twelve", "https://api.twelvedata.com/time_series",
            params={"symbol": symbol, "interval": "1day",
                    "outputsize": 366 if symbol == "GLD" else 7 if symbol == "XAU/USD" else 1,
                    "apikey": os.getenv("TWELVE_DATA_API_KEY")},
        )

    async def gold(self):
        return await self.fetch(
            "gold", "gold", "https://www.goldapi.io/api/price/XAU/USD",
            headers={"x-access-token": os.getenv("GOLD_API_KEY")},
        )


market_data = MarketData()
