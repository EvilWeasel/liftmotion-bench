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
  Legend,
} from "recharts";
import type { PositionSample } from "@/lib/types";

const MAX_SAMPLES = 10000;
const UPDATE_THROTTLE_MS = 16; // ~60 FPS

interface LiveChartProps {
  samples: PositionSample[];
  className?: string;
}

export function LiveChart({ samples, className }: LiveChartProps) {
  const [displaySamples, setDisplaySamples] = useState<PositionSample[]>([]);
  const lastUpdateRef = useRef<number>(0);

  // Downsample and throttle updates for smooth rendering
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) {
      return;
    }
    lastUpdateRef.current = now;

    // Downsample: keep every Nth sample or use time-based bucketing
    // For 500 Hz input, we'll keep roughly every 8th sample for ~60 Hz display
    const downsampleFactor = Math.max(1, Math.floor(samples.length / 1000));
    const downsampled = samples.filter((_, index) => index % downsampleFactor === 0);
    
    setDisplaySamples(downsampled);
  }, [samples]);

  // Prepare data for chart
  const chartData = useMemo(() => {
    if (displaySamples.length === 0) {
      return [];
    }

    // Group by timestamp and separate master/slave
    const dataMap = new Map<number, { time: number; master?: number; slave?: number }>();

    displaySamples.forEach((sample) => {
      const time = sample.timestamp;
      if (!dataMap.has(time)) {
        dataMap.set(time, { time });
      }
      const entry = dataMap.get(time)!;
      if (sample.channel === "master") {
        entry.master = sample.position;
      } else {
        entry.slave = sample.position;
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
  }, [displaySamples]);

  // Calculate time range for relative time display
  const timeRange = useMemo(() => {
    if (displaySamples.length === 0) return { min: 0, max: 0 };
    const times = displaySamples.map((s) => s.timestamp);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    return { min: minTime, max: maxTime };
  }, [displaySamples]);

  // Transform data to relative time (seconds from start)
  const chartDataWithRelativeTime = useMemo(() => {
    if (timeRange.min === 0 && timeRange.max === 0) return [];
    return chartData.map((point) => ({
      ...point,
      time: point.time - timeRange.min,
    }));
  }, [chartData, timeRange]);

  // Calculate position range for auto-scaling
  const positionRange = useMemo(() => {
    const positions = displaySamples.map((s) => s.position);
    if (positions.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const padding = (max - min) * 0.1 || 0.1;
    return { min: min - padding, max: max + padding };
  }, [displaySamples]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {`Zeit: ${payload[0].payload.time.toFixed(2)}s`}
        </p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-sm"
            style={{ color: entry.color }}
          >
            {`${entry.dataKey === "master" ? "Master" : "Slave"}: ${entry.value?.toFixed(3) ?? "N/A"} m`}
          </p>
        ))}
      </div>
    );
  };

  if (chartDataWithRelativeTime.length === 0) {
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
          data={chartDataWithRelativeTime}
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
          <Legend />
          <Line
            type="monotone"
            dataKey="master"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Master"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="slave"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="Slave"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

