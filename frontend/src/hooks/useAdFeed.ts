import { useEffect, useState, useRef, useCallback } from "react";
import type { AdPrediction } from "../types";
import { logger } from "../utils/logger";

// Decoupling (Anti-Rigidity): Dynamic Configuration
export interface AdFeedConfig {
  wsUrl?: string;
  maxFeedSize?: number;
  reconnectInterval?: number;
  highValueThreshold?: number;
}

const DEFAULT_CONFIG: Required<AdFeedConfig> = {
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/feed",
  maxFeedSize: 50,
  reconnectInterval: 3000,
  highValueThreshold: 0.7,
};

// Self-Explaining Exceptions
abstract class SelfExplainingError extends Error {
  context: Record<string, any>;
  reason: string;
  howToFix: string;
  constructor(reason: string, howToFix: string, context: Record<string, any>) {
    super(`[WHY] ${reason} | [FIX] ${howToFix}`);
    this.reason = reason;
    this.howToFix = howToFix;
    this.context = context;
  }
}

class WebSocketConnectionError extends SelfExplainingError {
  constructor(reason: string, howToFix: string, context: Record<string, any>) {
    super(reason, howToFix, context);
    this.name = "WebSocketConnectionError";
  }
}

class DataBoundaryError extends SelfExplainingError {
  constructor(reason: string, howToFix: string, context: Record<string, any>) {
    super(reason, howToFix, context);
    this.name = "DataBoundaryError";
  }
}

// Strict Boundary Check (Read-Only Validation)
function validateAdPrediction(data: any): data is AdPrediction {
  if (!data || typeof data !== "object") return false;
  if (typeof data.ctr_probability !== "number") return false;
  if (!data.request || typeof data.request !== "object") return false;
  if (typeof data.request.ad_id !== "string") return false;
  if (typeof data.request.timestamp !== "string") return false;
  return true;
}

export function useAdFeed(config?: AdFeedConfig) {
  // Merge defaults with runtime config
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [predictions, setPredictions] = useState<AdPrediction[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  
  // Connection Session ID acts as the base CONTEXT_ID
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));

  const connect = useCallback(() => {
    logger.debug("useAdFeed/connect", sessionId.current, "Initiating WebSocket connection sequence", { config: finalConfig });

    if (ws.current) {
      logger.warn("useAdFeed/connect", sessionId.current, "Stale WebSocket instance detected. Purging before reconnect.");
      ws.current.close();
    }
    
    ws.current = new WebSocket(finalConfig.wsUrl);

    ws.current.onopen = () => {
      logger.info("useAdFeed/onopen", sessionId.current, "WebSocket successfully negotiated connection");
      setWsStatus("connected");
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onerror = () => {
      const error = new WebSocketConnectionError(
        "Underlying network socket reported a low-level error (Connection Refused/Reset).",
        "Verify that the backend service at wsUrl is running and CORS allows the frontend origin.",
        { readyState: ws.current?.readyState }
      );
      logger.error("useAdFeed/onerror", sessionId.current, "WebSocket network error observed", { url: finalConfig.wsUrl }, error);
      setWsStatus("error");
    };

    ws.current.onclose = (event) => {
      const error = new WebSocketConnectionError(
        `WebSocket connection terminated (code: ${event.code}).`,
        "Check network stability or backend server health. Backoff will continually retry.",
        { code: event.code, reason: event.reason, wasClean: event.wasClean }
      );
      logger.warn("useAdFeed/onclose", sessionId.current, "Socket closed. Engaging exponential backoff.", error.context);
      
      setWsStatus("error");
      
      reconnectTimeout.current = window.setTimeout(() => {
        logger.debug("useAdFeed/reconnect", sessionId.current, "Backoff interval elapsed. Attempting reconnection...");
        setWsStatus("connecting");
        connect();
      }, finalConfig.reconnectInterval);
    };

    ws.current.onmessage = (event) => {
      try {
        if (typeof event.data !== 'string' || !event.data) {
          throw new DataBoundaryError(
            "Received empty or non-string payload over WS.",
            "Backend must serialize predictions to JSON strings before emitting over the socket.",
            { dataTargetType: typeof event.data }
          );
        }

        const rawData = JSON.parse(event.data);
        
        // Extract a specific context ID for this message, fallback to session ID
        const messageContextId = rawData?.request?.ad_id || sessionId.current;

        // Perform strict boundary schema verification (Anti-Corruption verification)
        if (!validateAdPrediction(rawData)) {
           throw new DataBoundaryError(
             "JSON deserialized successfully, but the object schema violates the strictly defined AdPrediction shape.",
             "Verify the backend Python producer adheres to the AdPrediction interface contract. Do NOT attempt to mutate or backfill generated data here.",
             { rawReceived: rawData }
           );
        }

        logger.debug("useAdFeed/onmessage", messageContextId, "Successfully verified and ingested prediction payload.");
        
        setTotalProcessed((prev) => prev + 1);
        if (rawData.ctr_probability > finalConfig.highValueThreshold) {
          setHighValueCount((prev) => prev + 1);
        }

        setPredictions((prev) => [rawData, ...prev].slice(0, finalConfig.maxFeedSize));
      } catch (err) {
        if (err instanceof SelfExplainingError) {
          logger.error("useAdFeed/onmessage", sessionId.current, "Strict Boundary Validation Failed", err.context, err);
        } else {
          const parseError = new DataBoundaryError(
            "Fatal exception during message payload ingestion.",
            "Review the innerException trace to isolate the fault inside the event handler.",
            { innerException: err instanceof Error ? err.message : String(err) }
          );
          logger.error("useAdFeed/onmessage", sessionId.current, "Unexpected Ingestion Fault", parseError.context, parseError);
        }
      }
    };
  }, [finalConfig]);

  useEffect(() => {
    logger.debug("useAdFeed/useEffect", sessionId.current, "Mounting useAdFeed hook lifecycle");
    localStorage.setItem('session_id', sessionId.current);
    connect();

    return () => {
      logger.info("useAdFeed/cleanup", sessionId.current, "Unmounting hook. Cleansing memory limits and active sockets.");
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
      }
      ws.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount

  return { predictions, totalProcessed, highValueCount, wsStatus };
}
