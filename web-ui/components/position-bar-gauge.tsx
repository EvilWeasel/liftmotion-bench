"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";

type BarAnimation = {
  type: "spring" | "lerp";
  stiffness: number;
  maxSpeedPxPerSec: number;
};

const DEFAULT_ANIMATION: BarAnimation = {
  type: "spring",
  stiffness: 0.2,
  maxSpeedPxPerSec: 400,
};

const EPSILON = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export type PositionBarGaugeProps = {
  value: number; // meters
  min?: number;
  max?: number;
  height?: number;
  width?: number;
  ticks?: number;
  animation?: BarAnimation;
  className?: string;
};

export function PositionBarGauge({
  value,
  min = 0,
  max = 10,
  height = 220,
  width = 48,
  ticks = 10,
  animation = DEFAULT_ANIMATION,
  className,
}: PositionBarGaugeProps) {
  const fillRef = useRef<SVGRectElement>(null);

  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const hasInitRef = useRef(false);

  const valueToHeight = (v: number) => {
    const n = (clamp(v, min, max) - min) / (max - min);
    return n * height;
  };

  const updateFill = useCallback(
    (h: number) => {
      if (!fillRef.current) return;
      fillRef.current.setAttribute("height", h.toFixed(2));
      fillRef.current.setAttribute("y", (height - h).toFixed(2));
    },
    [height],
  );

  const animate = useCallback(
    (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.max((ts - lastTsRef.current) / 1000, 0);
      lastTsRef.current = ts;

      const current = currentRef.current;
      const target = targetRef.current;
      const diff = target - current;

      let step = diff;

      if (animation.type === "spring") {
        step = diff * animation.stiffness;
      } else {
        step = diff * Math.min(1, animation.stiffness);
      }

      const maxStep = animation.maxSpeedPxPerSec * dt;
      if (Math.abs(step) > maxStep) {
        step = Math.sign(step) * maxStep;
      }

      const next = Math.abs(diff) < EPSILON ? target : current + step;

      currentRef.current = next;
      updateFill(next);

      if (Math.abs(target - next) > EPSILON) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
        lastTsRef.current = null;
      }
    },
    [animation, updateFill],
  );

  const startAnimation = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  useEffect(() => {
    if (!Number.isFinite(value)) return;

    const h = valueToHeight(value);
    targetRef.current = h;

    if (!hasInitRef.current) {
      hasInitRef.current = true;
      currentRef.current = h;
      updateFill(h);
      return;
    }

    startAnimation();
  }, [value, startAnimation, updateFill]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <defs>
        <clipPath id="bar-clip">
          <rect x={0} y={0} width={width} height={height} rx={6} />
        </clipPath>
      </defs>

      {/* background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={6}
        fill="var(--muted)"
      />

      {/* ticks */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = height - (i / ticks) * height;
        return (
          <line
            key={i}
            x1={width * 0.6}
            x2={width}
            y1={y}
            y2={y}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        );
      })}

      {/* animated fill (CLIPPED) */}
      <g clipPath="url(#bar-clip)">
        <rect
          ref={fillRef}
          x={0}
          y={height}
          width={width}
          height={0}
          fill="var(--chart-1)"
        />
      </g>
    </svg>
  );
}
