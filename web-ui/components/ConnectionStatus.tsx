"use client";

import { ConnectionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, AlertCircle, Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: ConnectionState;
  eventCount?: number;
  className?: string;
}

export function ConnectionStatus({ state, eventCount = 0, className }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (state) {
      case "CONNECTED":
        return {
          icon: Wifi,
          text: "Verbunden",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          dotColor: "bg-green-500",
        };
      case "CONNECTING":
        return {
          icon: Loader2,
          text: "Verbinde...",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          dotColor: "bg-amber-500",
          animate: true,
        };
      case "DISCONNECTED":
        return {
          icon: WifiOff,
          text: "Getrennt",
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          dotColor: "bg-orange-500",
        };
      case "ERROR":
        return {
          icon: AlertCircle,
          text: "Fehler",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          dotColor: "bg-red-500",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5",
        config.bgColor,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`Verbindungsstatus: ${config.text}`}
    >
      <div className={cn("h-2 w-2 rounded-full", config.dotColor)} />
      <Icon
        className={cn("h-4 w-4", config.color, config.animate && "animate-spin")}
        aria-hidden="true"
      />
      <span className={cn("text-sm font-medium", config.color)}>{config.text}</span>
      {state === "CONNECTED" && eventCount > 0 && (
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {eventCount} Events
        </span>
      )}
    </div>
  );
}

