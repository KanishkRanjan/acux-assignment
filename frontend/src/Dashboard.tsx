import { useState } from "react";
import { useAdFeed } from "./hooks/useAdFeed";
import { Header } from "./components/Header";
import { MetricCard } from "./components/MetricCard";
import { LiveFeedTable } from "./components/LiveFeedTable";
import type { SortConfig, AdRequest } from "./types";

export default function Dashboard() {
  const { predictions, totalProcessed, highValueCount, wsStatus } = useAdFeed();

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterDevice, setFilterDevice] = useState("All");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
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

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="dashboard-container">
      <Header wsStatus={wsStatus} />

      <div className="metrics-grid">
        <MetricCard
          title="Total Ads Processed"
          value={totalProcessed.toLocaleString()}
        />
        <MetricCard
          title="High Value Ads (>0.70)"
          value={highValueCount.toLocaleString()}
          valueClass="green"
        />
      </div>

      <LiveFeedTable
        processedData={processedData}
        sortConfig={sortConfig}
        handleSort={handleSort}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterDevice={filterDevice}
        setFilterDevice={setFilterDevice}
      />
    </div>
  );
}
