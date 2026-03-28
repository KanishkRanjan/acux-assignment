import { useEffect, useState, useRef, useCallback } from "react";
import type { AdPrediction } from "../types";

const MAX_FEED_SIZE = 50;
const RECONNECT_INTERVAL = 3000;

export function useAdFeed() {
  const [predictions, setPredictions] = useState<AdPrediction[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/feed";
    
    // Explicitly clean up old connection if exists during a manual reconnect
    if (ws.current) {
      ws.current.close();
    }
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWsStatus("connected");
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onerror = () => setWsStatus("error");

    ws.current.onclose = () => {
      setWsStatus("error");
      // Reconnection backoff logic
      reconnectTimeout.current = window.setTimeout(() => {
        setWsStatus("connecting");
        connect();
      }, RECONNECT_INTERVAL);
    };

    ws.current.onmessage = (event) => {
      try {
        const data: AdPrediction = JSON.parse(event.data);

        setTotalProcessed((prev) => prev + 1);
        if (data.ctr_probability > 0.7) {
          setHighValueCount((prev) => prev + 1);
        }

        setPredictions((prev) => [data, ...prev].slice(0, MAX_FEED_SIZE));
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
      }
      ws.current?.close();
    };
  }, [connect]);

  return { predictions, totalProcessed, highValueCount, wsStatus };
}
