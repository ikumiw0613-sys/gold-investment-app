import unittest
from datetime import date

from market_period import history_start_date


class HistoryStartDateTests(unittest.TestCase):
    def test_seven_days_includes_today(self):
        self.assertEqual(history_start_date("7d", date(2026, 9, 28)), date(2026, 9, 22))

    def test_one_month_clamps_to_end_of_february(self):
        self.assertEqual(history_start_date("1m", date(2026, 3, 31)), date(2026, 2, 28))

    def test_three_months_crosses_year(self):
        self.assertEqual(history_start_date("3m", date(2026, 1, 31)), date(2025, 10, 31))

    def test_one_year_from_leap_day(self):
        self.assertEqual(history_start_date("1y", date(2024, 2, 29)), date(2023, 2, 28))


if __name__ == "__main__":
    unittest.main()
