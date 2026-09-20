import { useEffect } from "react";
import { fetchMarketData } from "./lib/market";


function App() {
  useEffect(() => {
    async function loadMarketData() {
      const data = await fetchMarketData();
      console.log(data);
    }

    loadMarketData();
  }, []);

  return null;
}

export default App
