"use client";

import React from "react";

import { useWebSocketElevatorData } from "@/hooks/useWebSocketElevatorData";

type ElevatorDataContextValue = ReturnType<
  typeof useWebSocketElevatorData
> & {
  autoScroll: boolean;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [autoScroll, setAutoScroll] = React.useState(true);

  const value = React.useMemo(
    () => ({ ...data, autoScroll, setAutoScroll }),
    [data, autoScroll],
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
