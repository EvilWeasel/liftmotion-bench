"use client";

import { useState, useEffect, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiveChart } from "@/components/LiveChart";
import type { PositionSample, PositionSamplePayload } from "@/lib/types";

const MAX_SAMPLES = 10000;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";

export default function Home() {
  const { isConnected, connectionState, lastEvent, error, reconnect, eventCount } =
    useWebSocket(WS_URL);
  const [samples, setSamples] = useState<PositionSample[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Process incoming events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "position_sample") {
      const payload = lastEvent.payload as PositionSamplePayload;
      const newSample: PositionSample = {
        timestamp: lastEvent.ts,
        channel: payload.channel,
        position: payload.position,
        position_raw: payload.position_raw,
      };

      setSamples((prev) => {
        const updated = [...prev, newSample];
        // Ring buffer: keep only last MAX_SAMPLES
        if (updated.length > MAX_SAMPLES) {
          return updated.slice(-MAX_SAMPLES);
        }
        return updated;
      });

      setLastUpdateTime(Date.now());
    } else if (lastEvent.type === "ride_start") {
      // Clear samples on new ride start
      setSamples([]);
    }
  }, [lastEvent]);

  // Calculate data rate (events per second)
  const dataRate = useMemo(() => {
    if (samples.length < 2) return 0;
    const timeSpan = samples[samples.length - 1].timestamp - samples[0].timestamp;
    if (timeSpan <= 0) return 0;
    return samples.length / timeSpan;
  }, [samples]);

  // Calculate time since last update
  const timeSinceLastUpdate = useMemo(() => {
    const elapsed = (Date.now() - lastUpdateTime) / 1000;
    return elapsed;
  }, [lastUpdateTime]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">LES02 Ride Curve Analyzer</h1>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus state={connectionState} eventCount={eventCount} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LiveChart samples={samples} className="w-full" />
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <span className="text-zinc-600 dark:text-zinc-400">
              Status:{" "}
              {samples.length > 0 ? (
                <span className="font-medium text-green-600 dark:text-green-400">
                  Empfange Daten
                </span>
              ) : (
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  Warte auf Daten
                </span>
              )}
            </span>
            {samples.length > 0 && (
              <>
                <span className="text-zinc-500 dark:text-zinc-500">|</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Samples: {samples.length.toLocaleString()}
                </span>
                {dataRate > 0 && (
                  <>
                    <span className="text-zinc-500 dark:text-zinc-500">|</span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Rate: {dataRate.toFixed(1)} Hz
                    </span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Letzte Aktualisierung:{" "}
            {timeSinceLastUpdate < 1
              ? "< 1s"
              : `${timeSinceLastUpdate.toFixed(1)}s`}{" "}
            ago
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
            role="alert"
          >
            <p className="font-medium">Fehler:</p>
            <p>{error.message}</p>
            <button
              onClick={reconnect}
              className="mt-2 rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 dark:bg-red-800 dark:hover:bg-red-900"
            >
              Erneut verbinden
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
