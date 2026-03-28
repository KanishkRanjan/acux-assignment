import { useEffect, useState, useRef, useCallback } from "react";
import type { AdPrediction } from "../types";
import { logger } from "../utils/logger";

const MAX_FEED_SIZE = 50;
const RECONNECT_INTERVAL = 3000;

class WebSocketConnectionError extends Error {
  context: Record<string, any>;
  constructor(message: string, context: Record<string, any>) {
    super(message);
    this.name = "WebSocketConnectionError";
    this.context = context;
  }
}

class DataParseError extends Error {
  context: Record<string, any>;
  constructor(message: string, context: Record<string, any>) {
    super(message);
    this.name = "DataParseError";
    this.context = context;
  }
}

export function useAdFeed() {
  const [predictions, setPredictions] = useState<AdPrediction[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  const connect = useCallback(() => {
    logger.debug("useAdFeed/connect", "Initiating WebSocket connection sequence", { MAX_FEED_SIZE, RECONNECT_INTERVAL });

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/feed";
    
    // Explicitly clean up old connection if exists during a manual reconnect
    if (ws.current) {
      logger.warn("useAdFeed/connect", "Stale WebSocket instance detected during connect interval. Purging.");
      ws.current.close();
    }
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      logger.info("useAdFeed/onopen", "WebSocket successfully negotiated connection", { url: wsUrl });
      setWsStatus("connected");
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onerror = () => {
      const error = new WebSocketConnectionError("Underlying network socket reported a low-level error", { readyState: ws.current?.readyState });
      logger.error("useAdFeed/onerror", "WebSocket error observed", { url: wsUrl }, error);
      setWsStatus("error");
    };

    ws.current.onclose = (event) => {
      const error = new WebSocketConnectionError("WebSocket connection terminated", { code: event.code, reason: event.reason, wasClean: event.wasClean });
      logger.warn("useAdFeed/onclose", "WebSocket closed. Engaging exponential backoff.", error.context);
      
      setWsStatus("error");
      
      // Reconnection backoff logic
      reconnectTimeout.current = window.setTimeout(() => {
        logger.debug("useAdFeed/reconnect", "Backoff interval elapsed. Attempting reconnection...");
        setWsStatus("connecting");
        connect();
      }, RECONNECT_INTERVAL);
    };

    ws.current.onmessage = (event) => {
      try {
        // Guard Clause: Ensure native JS execution isn't operating on a string that can't be parsed.
        if (typeof event.data !== 'string' || !event.data) {
          throw new DataParseError("Received empty or non-string payload over WS", { dataTargetType: typeof event.data });
        }

        const data: AdPrediction = JSON.parse(event.data);

        // Guard Clause: Ensure the contract hasn't been completely broken
        if (!data || !data.request) {
           throw new DataParseError("JSON deserialized but missing core expected schema properties", { raw: event.data });
        }

        setTotalProcessed((prev) => prev + 1);
        if (data.ctr_probability > 0.7) {
          setHighValueCount((prev) => prev + 1);
        }

        setPredictions((prev) => [data, ...prev].slice(0, MAX_FEED_SIZE));
      } catch (err) {
        const parseError = new DataParseError("Failed to ingest prediction dataframe", { 
          rawPayload: event.data, 
          innerException: err instanceof Error ? err.message : String(err) 
        });
        logger.error("useAdFeed/onmessage", "Message payload ingestion failed", parseError.context, parseError);
      }
    };
  }, []);

  useEffect(() => {
    logger.debug("useAdFeed/useEffect", "Mounting useAdFeed hook lifecycle");
    connect();

    return () => {
      logger.info("useAdFeed/cleanup", "Unmounting hook. Cleansing memory limits and active sockets.");
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
      }
      ws.current?.close();
    };
  }, [connect]);

  return { predictions, totalProcessed, highValueCount, wsStatus };
}
