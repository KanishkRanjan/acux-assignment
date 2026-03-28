import React from "react";
import type { AdPrediction, SortConfig } from "../types";
import { formatId, formatTime, getScoreInfo } from "../utils/formatters";
import { FilterControls } from "./FilterControls";

interface LiveFeedTableProps {
  processedData: AdPrediction[];
  sortConfig: SortConfig;
  handleSort: (key: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterDevice: string;
  setFilterDevice: (val: string) => void;
}

export const LiveFeedTable: React.FC<LiveFeedTableProps> = ({
  processedData,
  sortConfig,
  handleSort,
  filterCategory,
  setFilterCategory,
  filterDevice,
  setFilterDevice,
}) => {
  return (
    <div className="table-section">
      <div className="table-header-row">
        <div className="table-header">
          <div className="table-dot"></div>
          <h2>Live Ad Auction Feed</h2>
        </div>
        <FilterControls
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterDevice={filterDevice}
          setFilterDevice={setFilterDevice}
        />
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
              <th onClick={() => handleSort("site_category")} className="sortable">
                Category{" "}
                {sortConfig?.key === "site_category" &&
                  (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th onClick={() => handleSort("device_type")} className="sortable">
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
                <td colSpan={5} style={{ textAlign: "center", color: "#9ca3af" }}>
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
                    <td style={{ color: "#d1d5db" }}>{formatId(req.ad_id)}</td>
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
  );
};
