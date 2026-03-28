export interface AdRequest {
  ad_id: string;
  timestamp: string;
  site_category: string;
  device_type: string;
}

export interface AdPrediction {
  request: AdRequest;
  ctr_probability: number;
  status: string;
  error: string | null;
}

export type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;
