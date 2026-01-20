/**
 * Type definitions for WebSocket events and data structures
 */

export interface EventEnvelope {
  proto: number;
  type: string;
  ts: number;
  source: string;
  payload: Record<string, unknown>;
}

export interface PositionSamplePayload {
  ride_id: string;
  channel: "master" | "slave";
  position_raw: number;
  position: number;
  unit: string;
}

export interface PositionSample {
  timestamp: number;
  channel: "master" | "slave";
  position: number;
  position_raw: number;
}

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

