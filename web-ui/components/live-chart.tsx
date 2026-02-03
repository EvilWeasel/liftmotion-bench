"use client";

import React from "react";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveGauge } from "@/components/live-gauge";
import { Play, Pause, RotateCcw, Focus, ZoomIn, ZoomOut } from "lucide-react";
import type { MotionSample, PositionState } from "@/lib/types";

const DEFAULT_WINDOW_SECONDS = 20; // Default: 20 seconds of data
const MIN_WINDOW_SECONDS = 10; // Minimum zoom: 10 seconds
const MAX_WINDOW_SECONDS = 60; // Maximum zoom: 60 seconds
const ZOOM_STEP = 5; // Zoom increment in seconds

interface LiveChartProps {
  samples: MotionSample[];
  isRunning: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
}

const positionChartConfig = {
  position: {
    label: "Position (mm)",
    color: "hsl(var(--chart-1))",
  },
};

const speedChartConfig = {
  speed: {
    label: "Speed (m/s)",
    color: "hsl(var(--chart-2))",
  },
};

const accelerationChartConfig = {
  acceleration: {
    label: "Acceleration (m/s²)",
    color: "hsl(var(--chart-3))",
  },
};

export function LiveChart({
  samples,
  isRunning,
  onToggleRunning,
  onReset,
}: LiveChartProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [fixedEndTime, setFixedEndTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [windowSeconds, setWindowSeconds] = useState(DEFAULT_WINDOW_SECONDS);
  const dragStartX = useRef<number | null>(null);
  const dragStartEndTime = useRef<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setWindowSeconds((prev) => Math.max(MIN_WINDOW_SECONDS, prev - ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setWindowSeconds((prev) => Math.min(MAX_WINDOW_SECONDS, prev + ZOOM_STEP));
  }, []);

  // Get the time range
  const timeRange = useMemo(() => {
    if (samples.length === 0)
      return { start: 0, end: windowSeconds, baseTime: Date.now() };

    const baseTime = samples[0].timestamp;
    const latestTime = samples[samples.length - 1].timestamp;
    const totalDuration = (latestTime - baseTime) / 1000;

    if (autoScroll) {
      const end = Math.max(totalDuration, windowSeconds);
      const start = Math.max(0, end - windowSeconds);
      return { start, end, baseTime };
    } else {
      const end = fixedEndTime ?? totalDuration;
      const start = Math.max(0, end - windowSeconds);
      return { start, end, baseTime };
    }
  }, [samples, autoScroll, fixedEndTime, windowSeconds]);

  const chartData = useMemo(() => {
    if (samples.length === 0) return [];

    const { start, end, baseTime } = timeRange;
    const paddedStart = Math.max(0, start - 1);
    const paddedEnd = end + 1;

    return samples
      .map((s) => {
        const timeNum = (s.timestamp - baseTime) / 1000;
        return {
          timeNum,
          position_mm: s.position_mm,
          velocity_m_s: s.velocity_mm_s / 1000,
          acceleration_m_s2: s.acceleration_mm_s2 / 1000,
        };
      })
      .filter((d) => d.timeNum >= paddedStart && d.timeNum <= paddedEnd);
  }, [samples, timeRange]);

  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;

  const currentPosition = latestSample?.position_mm ?? 0;
  const currentSpeed = latestSample?.velocity_mm_s ?? 0;
  const currentAcceleration = latestSample?.acceleration_mm_s2 ?? 0;

  const currentFloor = currentPosition >= 5000 ? "OG" : "EG";

  // Handle mouse/touch drag to scroll
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStartX.current = e.clientX;

      const baseTime = samples.length > 0 ? samples[0].timestamp : Date.now();
      const latestTime =
        samples.length > 0 ? samples[samples.length - 1].timestamp : Date.now();
      const totalDuration = (latestTime - baseTime) / 1000;

      if (autoScroll) {
        setAutoScroll(false);
        const currentEndTime = Math.max(totalDuration, windowSeconds);
        setFixedEndTime(currentEndTime);
        dragStartEndTime.current = currentEndTime;
      } else {
        dragStartEndTime.current = fixedEndTime ?? totalDuration;
      }
    },
    [autoScroll, fixedEndTime, samples, windowSeconds],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        !isDragging ||
        dragStartX.current === null ||
        !chartContainerRef.current
      )
        return;

      const containerWidth = chartContainerRef.current.offsetWidth;
      const deltaX = e.clientX - dragStartX.current;
      const secondsPerPixel = windowSeconds / containerWidth;
      const deltaSeconds = deltaX * secondsPerPixel;

      const baseTime = samples.length > 0 ? samples[0].timestamp : Date.now();
      const latestTime =
        samples.length > 0 ? samples[samples.length - 1].timestamp : Date.now();
      const totalDuration = (latestTime - baseTime) / 1000;

      const newEndTime = dragStartEndTime.current - deltaSeconds;
      const clampedEndTime = Math.max(
        windowSeconds,
        Math.min(totalDuration, newEndTime),
      );
      setFixedEndTime(clampedEndTime);
    },
    [isDragging, samples, windowSeconds],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartX.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      dragStartX.current = null;
    }
  }, [isDragging]);

  const handleResumeAutoScroll = useCallback(() => {
    setAutoScroll(true);
    setFixedEndTime(null);
  }, []);

  const handleReset = useCallback(() => {
    onReset();
    setAutoScroll(true);
    setFixedEndTime(null);
  }, [onReset]);

  // Shared X-axis props
  const xAxisProps = {
    dataKey: "timeNum" as const,
    type: "number" as const,
    domain: [timeRange.start, timeRange.end] as [number, number],
    tickFormatter: (value: number) => `${value.toFixed(1)}s`,
    className: "text-muted-foreground",
    tick: { fontSize: 12 },
    allowDataOverflow: true,
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              Elevator Position Monitor
            </CardTitle>
            <div className="grid items-center gap-2 flex-wrap">
              <div className="col-start-1 flex flex-col gap-1">
                <p className="text-muted-foreground">Position</p>
                <LiveGauge
                  value={currentPosition / 1000}
                  unit="m"
                  scale={{ min: 0, max: 12 }}
                  ticks={{ step: 2, showLabels: true }}
                  zones={[
                    { from: 0, to: 60, color: "hsl(142.1 76.2% 36.3%)" },
                    { from: 60, to: 80, color: "hsl(38.5 95.8% 53.1%)" },
                    { from: 80, to: 100, color: "hsl(0 84.2% 60.2%)" },
                  ]}
                  animation={{
                    type: "spring",
                    stiffness: 0.15,
                    maxSpeedDegPerSec: 270,
                  }}
                  valueBehavior="clamp"
                  className="h-[140px] w-[220px]"
                />
              </div>
              <div className="col-start-2 flex flex-col gap-1">
                <p className="text-muted-foreground">Speed</p>
                <Badge variant="secondary" className="font-mono">
                  {Math.abs(currentSpeed / 1000).toFixed(2)} m/s
                </Badge>
              </div>
              {/*

              <div className="col-start-3 flex flex-col gap-1">
                <p className="text-muted-foreground">Acceleration</p>
                <Badge variant="secondary" className="font-mono">
                  {Math.abs(currentAcceleration / 1000).toFixed(2)} m/s²
                </Badge>
              </div>
              */}

              <div className="col-start-4 flex flex-col gap-1">
                <Badge variant="outline" className="font-mono">
                  Floor {currentFloor}
                </Badge>
                {!autoScroll && (
                  <Badge variant="destructive" className="text-xs">
                    Auto-scroll paused
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResumeAutoScroll}
                className="gap-1 bg-transparent"
              >
                <Focus className="h-4 w-4" />
                Live
              </Button>
            )}
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={windowSeconds <= MIN_WINDOW_SECONDS}
                title="Zoom in (show less time)"
                className="h-8 w-8"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono px-1 min-w-[3rem] text-center">
                {windowSeconds}s
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={windowSeconds >= MAX_WINDOW_SECONDS}
                title="Zoom out (show more time)"
                className="h-8 w-8"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleRunning}
              title={isRunning ? "Pause data" : "Resume data"}
            >
              {isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              title="Reset chart"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Charts Container - draggable area */}
      <div
        ref={chartContainerRef}
        className="select-none space-y-4"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Position Chart */}
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Position over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={positionChartConfig}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[0, 11000]}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}m`}
                    className="text-muted-foreground"
                    tick={{ fontSize: 12 }}
                    width={50}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload && payload[0]) {
                            return `Time: ${Number(payload[0].payload.timeNum).toFixed(2)}s`;
                          }
                          return "";
                        }}
                        formatter={(value) => [
                          `${((value as number) / 1000).toFixed(3)} m`,
                          "Position",
                        ]}
                      />
                    }
                  />
                  <ReferenceLine
                    y={0}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeOpacity={0.3}
                    label={{
                      value: "Floor 1",
                      position: "right",
                      fontSize: 11,
                      fill: "currentColor",
                      opacity: 0.6,
                    }}
                  />
                  <ReferenceLine
                    y={10000}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeOpacity={0.3}
                    label={{
                      value: "Floor 2",
                      position: "right",
                      fontSize: 11,
                      fill: "currentColor",
                      opacity: 0.6,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="position_mm"
                    stroke="hsl(221.2 83.2% 53.3%)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Speed Chart */}
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Speed over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={speedChartConfig}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[-3, 3]}
                    tickFormatter={(value) => `${value.toFixed(1)}`}
                    className="text-muted-foreground"
                    tick={{ fontSize: 12 }}
                    width={50}
                    label={{
                      value: "m/s",
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle" },
                      fill: "currentColor",
                      opacity: 0.6,
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload && payload[0]) {
                            return `Time: ${Number(payload[0].payload.timeNum).toFixed(2)}s`;
                          }
                          return "";
                        }}
                        formatter={(value) => [
                          `${(value as number).toFixed(3)} m/s`,
                          "Speed",
                        ]}
                      />
                    }
                  />
                  <ReferenceLine
                    y={0}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="velocity_m_s"
                    stroke="hsl(142.1 76.2% 36.3%)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Acceleration Chart */}
        {/*
          
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Acceleration over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={accelerationChartConfig}
              className="h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[-5, 5]}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{
                      value: "m/s²",
                      angle: -90,
                      position: "insideLeft",
                      fill: "currentColor",
                      opacity: 0.6,
                    }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="acceleration_m_s2"
                    stroke="hsl(38.5 95.8% 53.1%)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        */}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Drag left/right to view history. Click &quot;Live&quot; to resume
        auto-scroll.
      </p>
    </div>
  );
}
