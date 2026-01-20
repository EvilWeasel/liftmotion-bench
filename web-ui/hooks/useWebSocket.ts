"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EventEnvelope, ConnectionState } from "@/lib/types";

interface UseWebSocketReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  lastEvent: EventEnvelope | null;
  error: Error | null;
  reconnect: () => void;
  eventCount: number;
}

const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("CONNECTING");
  const [lastEvent, setLastEvent] = useState<EventEnvelope | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const shouldReconnectRef = useRef(true);
  const reconnectAttemptRef = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionState("CONNECTING");
      setError(null);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setConnectionState("CONNECTED");
        setError(null);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as EventEnvelope;
          setLastEvent(data);
          setEventCount((prev) => prev + 1);
          setError(null);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
          setError(new Error("Failed to parse message"));
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError(new Error("WebSocket connection error"));
        setConnectionState("ERROR");
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        setConnectionState("DISCONNECTED");

        // Attempt reconnect if we should
        if (shouldReconnectRef.current && connectRef.current) {
          const delay = Math.min(
            reconnectDelayRef.current * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          );
          
          reconnectAttemptRef.current += 1;
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (connectRef.current) {
              connectRef.current();
            }
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError(err instanceof Error ? err : new Error("Failed to create WebSocket"));
      setConnectionState("ERROR");
    }
  }, [url]);

  const reconnect = useCallback(() => {
    shouldReconnectRef.current = true;
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    reconnectAttemptRef.current = 0;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    connect();
  }, [connect]);

  // Store connect function in ref to avoid circular dependency
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    connectionState,
    lastEvent,
    error,
    reconnect,
    eventCount,
  };
}

