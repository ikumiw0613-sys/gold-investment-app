from datetime import date as Date

from sqlmodel import Field, SQLModel


class InvestmentRecordData(SQLModel):
    id: str = Field(primary_key=True)
    date: Date

    added_points: int
    fee_points: float
    invested_points: float

    gld_price: float
    usd_jpy: float
    approximate_price: float
    virtual_amount: float

class InvestmentRecord(InvestmentRecordData, table=True):
    __tablename__ = "investment_records"

class MarketPrice(SQLModel, table=True):
    __tablename__ = "market_prices"

    id: int | None = Field(default=None, primary_key=True)
    date: Date = Field(unique=True)
    gld_price: float
    usd_jpy: float
    xau_usd_price: float
