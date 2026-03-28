import React from "react";

interface HeaderProps {
  wsStatus: "connecting" | "connected" | "error";
}

export const Header: React.FC<HeaderProps> = ({ wsStatus }) => {
  return (
    <div className="top-header">
      <h1>ECHO-AD DASHBOARD</h1>
      <div className="status-indicators">
        <div className="indicator">
          <div className={`dot ${wsStatus === "connected" ? "green" : "red"}`}></div>
          LIVE STREAMING
        </div>
        <div className="indicator">
          <div className="dot green"></div>
          PIPELINE ACTIVE
        </div>
      </div>
    </div>
  );
};
