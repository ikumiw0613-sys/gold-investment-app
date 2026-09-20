from fastapi import FastAPI
import os
import httpx
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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