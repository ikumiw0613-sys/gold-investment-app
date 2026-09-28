from calendar import monthrange
from datetime import date, timedelta
from typing import Literal

MarketPeriod = Literal["7d", "1m", "3m", "1y"]


def history_start_date(period: MarketPeriod, today: date) -> date:
    if period == "7d":
        return today - timedelta(days=6)

    months = {"1m": 1, "3m": 3, "1y": 12}[period]
    month_index = today.year * 12 + today.month - 1 - months
    year, month = divmod(month_index, 12)
    month += 1
    return date(year, month, min(today.day, monthrange(year, month)[1]))
