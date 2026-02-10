"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PositionState,
  ConnectionState,
  EventEnvelope,
  MotionSample,
} from "@/lib/types";

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useWebSocketElevatorData(url: string) {
  const [samples, setSamples] = useState<MotionSample[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("CONNECTING");
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setConnectionState("CONNECTING");
      setError(null);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        setConnectionState("CONNECTED");
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          if (!isRunning) return;

          const envelope = JSON.parse(event.data) as EventEnvelope;

          switch (envelope.type) {
            case "motion_sample":
              const payload = envelope.payload as MotionSample;
              const sample: MotionSample = {
                timestamp: payload.timestamp * 1000, // Sekunden → ms
                position_mm: payload.position_mm,
                velocity_mm_s: payload.velocity_mm_s,
                acceleration_mm_s2: payload.acceleration_mm_s2,
              };
              setSamples((prev) => [...prev, sample]);
              break;
            default:
              return;
          }
        } catch (err) {
          setError(new Error("Failed to parse WebSocket message"));
        }
      };

      ws.onerror = () => {
        setError(new Error("WebSocket error"));
        setConnectionState("ERROR");
      };

      ws.onclose = () => {
        setConnectionState("DISCONNECTED");

        if (!shouldReconnectRef.current) return;

        const delay = Math.min(
          reconnectDelayRef.current * 2 ** reconnectAttemptRef.current,
          MAX_RECONNECT_DELAY,
        );

        reconnectAttemptRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("WebSocket init failed"));
      setConnectionState("ERROR");
    }
    // todo: remove isRunning from deps; can cause issues with reconnect logic; consider using a ref instead or deprecating the pause button altogether
  }, [url, isRunning]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    setSamples([]);
  }, []);

  return {
    samples,
    isRunning,
    toggleRunning,
    reset,
    connectionState,
    error,
  };
}
