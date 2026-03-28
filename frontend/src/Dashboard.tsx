import { useEffect, useState, useRef } from "react";

interface AdRequest {
  ad_id: string;
  timestamp: string;
  site_category: string;
  device_type: string;
}

interface AdPrediction {
  request: AdRequest;
  ctr_probability: number;
  status: string;
  error: string | null;
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<AdPrediction[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterDevice, setFilterDevice] = useState("All");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/feed";
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => setWsStatus("connected");
    ws.current.onerror = () => setWsStatus("error");
    ws.current.onclose = () => setWsStatus("error");

    ws.current.onmessage = (event) => {
      try {
        const data: AdPrediction = JSON.parse(event.data);

        setTotalProcessed((prev) => prev + 1);
        if (data.ctr_probability > 0.7) {
          setHighValueCount((prev) => prev + 1);
        }

        setPredictions((prev) => [data, ...prev].slice(0, 50));
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const getScoreInfo = (ctr: number) => {
    if (ctr > 0.7)
      return { dotClass: "green", textClass: "green", label: "(High Value)" };
    if (ctr < 0.3)
      return { dotClass: "red", textClass: "red", label: "(Low Value)" };
    return { dotClass: "neutral", textClass: "neutral", label: "(Average)" };
  };

  const formatId = (id: string) => `#${id.substring(0, 4).toUpperCase()}`;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Derived filtered & sorted data
  const processedData = [...predictions]
    .filter((p) => {
      const catMatch =
        filterCategory === "All" ||
        p.request.site_category.toLowerCase() === filterCategory.toLowerCase();
      const devMatch =
        filterDevice === "All" ||
        p.request.device_type.toLowerCase() === filterDevice.toLowerCase();
      return catMatch && devMatch;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      let valA: any, valB: any;
      if (key === "score") {
        valA = a.ctr_probability;
        valB = b.ctr_probability;
      } else if (key === "time") {
        valA = new Date(a.request.timestamp).getTime();
        valB = new Date(b.request.timestamp).getTime();
      } else {
        valA = a.request[key as keyof AdRequest];
        valB = b.request[key as keyof AdRequest];
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <div className="top-header">
        <h1>ECHO-AD DASHBOARD</h1>
        <div className="status-indicators">
          <div className="indicator">
            <div
              className={`dot ${wsStatus === "connected" ? "green" : "red"}`}
            ></div>
            LIVE STREAMING
          </div>
          <div className="indicator">
            <div className="dot green"></div>
            PIPELINE ACTIVE
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Ads Processed</h3>
          <div className="value">{totalProcessed.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3>High Value Ads ({">"}0.70)</h3>
          <div className="value green">{highValueCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Live Feed Table */}
      <div className="table-section">
        <div className="table-header-row">
          <div className="table-header">
            <div className="table-dot"></div>
            <h2>Live Ad Auction Feed</h2>
          </div>
          <div className="filter-controls">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="finance">Finance</option>
              <option value="travel">Travel</option>
              <option value="news">News</option>
              <option value="gaming">Gaming</option>
              <option value="social">Social</option>
            </select>
            <select
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
            >
              <option value="All">All Devices</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("time")} className="sortable">
                  Timestamp{" "}
                  {sortConfig?.key === "time" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("ad_id")} className="sortable">
                  Ad ID{" "}
                  {sortConfig?.key === "ad_id" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("site_category")}
                  className="sortable"
                >
                  Category{" "}
                  {sortConfig?.key === "site_category" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("device_type")}
                  className="sortable"
                >
                  Device{" "}
                  {sortConfig?.key === "device_type" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("score")} className="sortable">
                  Prediction Score{" "}
                  {sortConfig?.key === "score" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {processedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", color: "#9ca3af" }}
                  >
                    No matching records found...
                  </td>
                </tr>
              ) : (
                processedData.map((pred, i) => {
                  const req = pred.request;
                  const ctr = pred.ctr_probability;
                  const info = getScoreInfo(ctr);
                  const rowClass = ctr < 0.3 ? "row-low" : "row-high";

                  return (
                    <tr key={`${req.ad_id}-${i}`} className={rowClass}>
                      <td>{formatTime(req.timestamp)}</td>
                      <td style={{ color: "#d1d5db" }}>
                        {formatId(req.ad_id)}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {req.site_category}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {req.device_type}
                      </td>
                      <td>
                        <div className="score-cell">
                          <div className={`score-dot ${info.dotClass}`}></div>
                          <span className={`score-text ${info.textClass}`}>
                            {ctr.toFixed(2)} {info.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
