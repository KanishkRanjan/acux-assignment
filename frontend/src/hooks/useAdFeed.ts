import { useEffect, useState, useRef } from "react";
import type { AdPrediction } from "../types";

export function useAdFeed() {
  const [predictions, setPredictions] = useState<AdPrediction[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");

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

  return { predictions, totalProcessed, highValueCount, wsStatus };
}
