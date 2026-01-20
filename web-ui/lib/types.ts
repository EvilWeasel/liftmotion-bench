/**
 * Type definitions for WebSocket events and data structures
 */
export interface PositionStatePayload {
  position_raw: number;
}

export interface PositionState {
  timestamp: number;
  position_raw: number;
}

export interface EventEnvelope {
  proto: number;
  type: string;
  ts: number;
  source: string;
  payload: Record<string, unknown>;
}

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

