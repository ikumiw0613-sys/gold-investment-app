from fastapi import FastAPI
import os
import httpx
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from database import engine
from sqlmodel import SQLModel,Session,select
from models import InvestmentRecord


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

API_KEY = os.getenv("TWELVE_DATA_API_KEY")
GOLD_API_KEY = os.getenv("GOLD_API_KEY")




@app.get("/")
def root():
    return {"message": "Gold Investment API"}


async def get_latest_close(symbol: str) -> float:
    url = "https://api.twelvedata.com/time_series"
    
    params = {
        "symbol" : symbol,
        "interval" : "1day",
        "outputsize" : 1,
        "apikey" : API_KEY,
        }
    
    async with httpx.AsyncClient() as client:
      response = await client.get(url,params = params)

    response.raise_for_status()
    
    data = response.json()
    
    close_price = float(data["values"][0]["close"])
    return close_price
    
async def get_xau_usd_data():
    url = "https://www.goldapi.io/api/price/XAU/USD"
    headers = {
        "x-access-token": GOLD_API_KEY
    }
    async with httpx.AsyncClient() as client:
          response = await client.get(url, headers=headers)

    response.raise_for_status()
  
    data = response.json()  
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
    url = "https://api.twelvedata.com/time_series"


    params = {
        "symbol": "XAU/USD",
        "interval" : "1day",
        "outputsize" : 7,
        "apikey" : API_KEY,
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url,params = params)

    response.raise_for_status()

    data = response.json()
    history = []

    for value in data["values"]:
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