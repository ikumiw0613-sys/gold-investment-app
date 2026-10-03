from fastapi import FastAPI
from datetime import date
from market_period import MarketPeriod, history_start_date
from market_data import market_data
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from database import engine
from sqlmodel import SQLModel,Session,select
from models import InvestmentRecord, MarketPrice

from apscheduler.schedulers.asyncio import AsyncIOScheduler



app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SQLModel.metadata.create_all(engine)
load_dotenv()





@app.get("/")
def root():
    return {"message": "Gold Investment API"}


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
    today = date.today()

    with Session(engine) as session:
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
        session.commit()
        session.refresh(market_price)

        return market_price


scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")

scheduler.add_job(
    save_today_market_price,
    "cron",
    hour=13,
    minute=58,
)

scheduler.start()

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
    today = date.today()
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
def create_investment(record: InvestmentRecord):
    with Session(engine) as session:
        session.add(record)
        session.commit()
        session.refresh(record)

    return record

@app.get("/investments")
def get_investments():
    with Session(engine) as session:
        statement = select(InvestmentRecord)
        records = session.exec(statement).all()

    return records

@app.get("/db-check")
def db_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"result": result.scalar()}


@app.post("/market-prices")
async def save_market_price():
    return await save_today_market_price()

@app.get("/market-prices")
def get_market_prices():
    with Session(engine) as session:
        statement = select(MarketPrice).order_by(MarketPrice.date.asc())
        prices = session.exec(statement).all()

    return prices