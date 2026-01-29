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
  payload: MotionSample;
}

export type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

export interface MotionSample {
  timestamp: number; // ms
  position_mm: number;
  velocity_mm_s: number;
  acceleration_mm_s2: number;
}
