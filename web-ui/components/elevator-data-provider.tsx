"use client";

import React from "react";

import { useWebSocketElevatorData } from "@/hooks/useWebSocketElevatorData";

const DEFAULT_WINDOW_SECONDS = 20;
const MIN_WINDOW_SECONDS = 10;
const MAX_WINDOW_SECONDS = 60;
const ZOOM_STEP_SECONDS = 5;

type ElevatorDataContextValue = ReturnType<
  typeof useWebSocketElevatorData
> & {
  autoScroll: boolean;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  fixedEndTime: number | null;
  setFixedEndTime: React.Dispatch<React.SetStateAction<number | null>>;
  windowSeconds: number;
  setWindowSeconds: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  resumeAutoScroll: () => void;
  resetChart: () => void;
};

const ElevatorDataContext = React.createContext<ElevatorDataContextValue | null>(
  null,
);

export function ElevatorDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";
  const data = useWebSocketElevatorData(WS_URL);
  const { reset } = data;
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [fixedEndTime, setFixedEndTime] = React.useState<number | null>(null);
  const [windowSeconds, setWindowSeconds] = React.useState(
    DEFAULT_WINDOW_SECONDS,
  );

  const zoomIn = React.useCallback(() => {
    setWindowSeconds((prev) =>
      Math.max(MIN_WINDOW_SECONDS, prev - ZOOM_STEP_SECONDS),
    );
  }, []);

  const zoomOut = React.useCallback(() => {
    setWindowSeconds((prev) =>
      Math.min(MAX_WINDOW_SECONDS, prev + ZOOM_STEP_SECONDS),
    );
  }, []);

  const resumeAutoScroll = React.useCallback(() => {
    setAutoScroll(true);
    setFixedEndTime(null);
  }, []);

  const resetChart = React.useCallback(() => {
    reset();
    setAutoScroll(true);
    setFixedEndTime(null);
  }, [reset]);

  const canZoomIn = windowSeconds > MIN_WINDOW_SECONDS;
  const canZoomOut = windowSeconds < MAX_WINDOW_SECONDS;

  const value = React.useMemo(
    () => ({
      ...data,
      autoScroll,
      setAutoScroll,
      fixedEndTime,
      setFixedEndTime,
      windowSeconds,
      setWindowSeconds,
      zoomIn,
      zoomOut,
      canZoomIn,
      canZoomOut,
      resumeAutoScroll,
      resetChart,
    }),
    [
      data,
      autoScroll,
      fixedEndTime,
      windowSeconds,
      zoomIn,
      zoomOut,
      canZoomIn,
      canZoomOut,
      resumeAutoScroll,
      resetChart,
    ],
  );

  return (
    <ElevatorDataContext.Provider value={value}>
      {children}
    </ElevatorDataContext.Provider>
  );
}

export function useElevatorData() {
  const context = React.useContext(ElevatorDataContext);
  if (!context) {
    throw new Error(
      "useElevatorData must be used within an ElevatorDataProvider.",
    );
  }

  return context;
}
