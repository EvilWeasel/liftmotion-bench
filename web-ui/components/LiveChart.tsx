"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PositionState } from "@/lib/types";

const MAX_SAMPLES = 10000;
const UPDATE_THROTTLE_MS = 16; // ~60 FPS

interface LiveChartProps {
  samples: PositionState[];
  className?: string;
}

export function LiveChart({ samples, className }: LiveChartProps) {
  const [displaySamples, setDisplaySamples] = useState<PositionState[]>([]);
  const lastUpdateRef = useRef<number>(0);

  // Downsample and throttle updates for smooth rendering
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) {
      return;
    }
    lastUpdateRef.current = now;

    const downsampleFactor = Math.max(1, Math.floor(samples.length / 1000));
    const downsampled = samples.filter((_, index) => index % downsampleFactor === 0);

    setDisplaySamples(downsampled);
  }, [samples]);

  // Chart data with relative time
  const chartData = useMemo(() => {
    if (displaySamples.length === 0) return [];
    const minTime = Math.min(...displaySamples.map((s) => s.timestamp));
    return displaySamples.map((s) => ({
      time: (s.timestamp - minTime) / 1000, // convert to seconds relative to start
      position: s.position_raw,
    }));
  }, [displaySamples]);

  // Determine position range for auto-scaling
  const positionRange = useMemo(() => {
    if (displaySamples.length === 0) return { min: 0, max: 1 };
    const positions = displaySamples.map((s) => s.position_raw);
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const padding = (max - min) * 0.1 || 0.1;
    return { min: min - padding, max: max + padding };
  }, [displaySamples]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0].payload;
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {`Zeit: ${point.time.toFixed(2)}s`}
        </p>
        <p className="text-sm" style={{ color: "#10b981" }}>
          {`Position: ${point.position.toFixed(3)} m`}
        </p>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div
        className={`flex h-full min-h-[400px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Warte auf Daten...
        </p>
      </div>
    );
  }

  return (
    <div className={`h-[400px] w-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-zinc-300 dark:stroke-zinc-700"
          />
          <XAxis
            dataKey="time"
            type="number"
            scale="linear"
            domain={["auto", "auto"]}
            label={{ value: "Zeit (s)", position: "insideBottom", offset: -5 }}
            className="text-xs fill-zinc-600 dark:fill-zinc-400"
          />
          <YAxis
            type="number"
            domain={[positionRange.min, positionRange.max]}
            label={{ value: "Position (m)", angle: -90, position: "insideLeft" }}
            className="text-xs fill-zinc-600 dark:fill-zinc-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="position"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Position"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
