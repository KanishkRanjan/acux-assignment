import React from "react";

interface FilterControlsProps {
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterDevice: string;
  setFilterDevice: (val: string) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filterCategory,
  setFilterCategory,
  filterDevice,
  setFilterDevice,
}) => {
  return (
    <div className="filter-controls">
      <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
        <option value="All">All Categories</option>
        <option value="finance">Finance</option>
        <option value="travel">Travel</option>
        <option value="news">News</option>
        <option value="gaming">Gaming</option>
        <option value="social">Social</option>
      </select>
      <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
        <option value="All">All Devices</option>
        <option value="mobile">Mobile</option>
        <option value="desktop">Desktop</option>
      </select>
    </div>
  );
};
