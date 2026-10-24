import os
import secrets

from fastapi import FastAPI, Header, HTTPException
from datetime import datetime
from contextlib import asynccontextmanager
from market_period import MarketPeriod, history_start_date
from market_data import market_data
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy import text

from database import DatabaseConfigurationError, get_engine
from sqlmodel import Session, select
from models import InvestmentRecord, InvestmentRecordData, MarketPrice

from scheduler import daily_scheduler
from settings import CORS_ORIGINS, IS_VERCEL, SCHEDULER_ENABLED, TOKYO


def database_engine():
    try:
        return get_engine()
    except (DatabaseConfigurationError, SQLAlchemyError):
        # Connection errors may contain credentials; never return their text.
        raise HTTPException(503, "投資記録の保存先に接続できません。時間をおいて再度お試しください。") from None

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.scheduler = None
    # Vercel must be able to inspect/import the app and serve the UI without a DB.
    # Database routes initialize the connection and tables on first use.
    if IS_VERCEL:
        yield
        return
    engine = get_engine()
    if SCHEDULER_ENABLED:
        async with daily_scheduler(engine, save_today_market_price) as scheduler:
            app.state.scheduler = scheduler
            try:
                yield
            finally:
                app.state.scheduler = None
    else:
        yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Gold Investment API"}

@app.get("/health", include_in_schema=False)
def health():
    engine = database_engine()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "投資記録の保存先に接続できません。時間をおいて再度お試しください。") from None
    return {"status": "ok"}

async def get_latest_close(symbol: str) -> float:
    data = await market_data.series(symbol)

    close_price = float(data["values"][0]["close"])
    return close_price
    
async def get_xau_usd_data():
    data = await market_data.gold()
    price = float(data["price"])
    previous_close = float(data["prev_close_price"])
    change = float(data["change"])
    change_percent = float(data["change_percent"])

    return {
        "xauUsdPrice": price,
        "xauUsdPreviousClose": previous_close,
        "xauUsdChange": change,
        "xauUsdChangePercent": change_percent,        
    }

async def save_today_market_price():
    today = datetime.now(TOKYO).date()

    with Session(database_engine()) as session:
        statement = select(MarketPrice).where(MarketPrice.date == today)
        existing = session.exec(statement).first()

        if existing:
            return existing

        gld_price = await get_latest_close("GLD")
        usd_jpy = await get_latest_close("USD/JPY")
        xau_data = await get_xau_usd_data()

        market_price = MarketPrice(
            date=today,
            gld_price=gld_price,
            usd_jpy=usd_jpy,
            xau_usd_price=xau_data["xauUsdPrice"],
        )

        session.add(market_price)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            # Another request/process may have saved this date while we fetched prices.
            existing = session.exec(statement).first()
            if existing is None:
                raise
            return existing
        session.refresh(market_price)

        return market_price

@app.get("/market/gld")
async def get_gld():

    return {
        "gldPrice" : await get_latest_close("GLD")
    }

@app.get("/market/usd-jpy")
async def get_usd_jpy():
    return {
        "usdJpy" : await get_latest_close("USD/JPY")
    }

@app.get("/market/xau-usd")
async def get_xau_usd():

    xau_data = await get_xau_usd_data()
    return {
        **xau_data,
    }

@app.get("/market")
async def get_market():
    gld_price = await get_latest_close("GLD")
    usd_jpy = await get_latest_close("USD/JPY")
    xau_data = await get_xau_usd_data()
    return {
        "gldPrice" : gld_price,
        "usdJpy" : usd_jpy,
        **xau_data,

    }

@app.get("/market/xau-usd/history")
async def get_market_history():
    data = await market_data.series("XAU/USD")
    history = []

    for value in data["values"]:
        history.append({
            "date": value["datetime"],
            "price": float(value["close"]),
        })

    return history

@app.get("/market/gld/history")
async def get_gld_history(period: MarketPeriod = "7d"):
    today = datetime.now(TOKYO).date()
    start_date = history_start_date(period, today)
    data = await market_data.series("GLD")

    history = []

    for value in data["values"]:
        if not start_date.isoformat() <= value["datetime"][:10] <= today.isoformat():
            continue
        history.append({
            "date": value["datetime"],
            "price": float(value["close"]),
        })

    return history

@app.post("/investments")
def create_investment(record: InvestmentRecordData):
    record = InvestmentRecord.model_validate(record)
    with Session(database_engine()) as session:
        session.add(record)
        session.commit()
        session.refresh(record)

    return record

@app.get("/investments")
def get_investments():
    with Session(database_engine()) as session:
        statement = select(InvestmentRecord)
        records = session.exec(statement).all()

    return records

@app.post("/market-prices")
async def save_market_price():
    return await save_today_market_price()

@app.get("/cron/market-prices", include_in_schema=False)
async def cron_save_market_price(authorization: str | None = Header(default=None)):
    secret = os.getenv("CRON_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Cron is not configured")
    if not secrets.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await save_today_market_price()

@app.get("/market-prices")
def get_market_prices():
    with Session(database_engine()) as session:
        statement = select(MarketPrice).order_by(MarketPrice.date.asc())
        prices = session.exec(statement).all()

    return prices
