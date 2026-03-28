import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  valueClass?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, valueClass = "" }) => {
  return (
    <div className="metric-card">
      <h3>{title}</h3>
      <div className={`value ${valueClass}`.trim()}>{value}</div>
    </div>
  );
};
