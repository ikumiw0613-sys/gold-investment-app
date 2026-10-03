import DashboardPage from "./pages/DashboardPage";

import HistoryPage from "./pages/HistoryPage";
import { useEffect, useState } from "react";

function App() {
  const [page, setPage] = useState(() => window.location.hash === "#/history" ? "history" : "dashboard");
  useEffect(() => {
    const updatePage = () => setPage(window.location.hash === "#/history" ? "history" : "dashboard");
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);
  return <>
    <div className="dashboard"><nav className="page-navigation" aria-label="メインナビゲーション">
      <a href="#/" aria-current={page === "dashboard" ? "page" : undefined}>ダッシュボード</a>
      <a href="#/history" aria-current={page === "history" ? "page" : undefined}>投資履歴</a>
    </nav></div>
    {page === "history" ? <HistoryPage /> : <DashboardPage />}
  </>;
}

export default App;
