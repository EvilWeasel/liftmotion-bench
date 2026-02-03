"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GaugeScale = {
  min: number;
  max: number;
};

type GaugeTicks = {
  step: number;
  showLabels: boolean;
};

type GaugeZone = {
  from: number;
  to: number;
  color: string;
};

type GaugeAnimation = {
  type: "spring" | "lerp";
  stiffness: number;
  maxSpeedDegPerSec: number;
};

export type LiveGaugeProps = {
  value: number;
  unit: string;
  scale: GaugeScale;
  ticks?: GaugeTicks;
  zones?: GaugeZone[];
  animation?: GaugeAnimation;
  valueBehavior?: "clamp" | "freeze";
  className?: string;
};

const DEFAULT_ANIMATION: GaugeAnimation = {
  type: "spring",
  stiffness: 0.15,
  maxSpeedDegPerSec: 270,
};

const DEFAULT_TICKS: GaugeTicks = {
  step: 1,
  showLabels: true,
};

const GAUGE_SIZE = {
  width: 220,
  height: 140,
  centerX: 110,
  centerY: 110,
  radius: 80,
};

const EPSILON = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toRadians(angle: number) {
  return (angle * Math.PI) / 180;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
) {
  const radians = toRadians(angle);
  return {
    x: centerX + radius * Math.sin(radians),
    y: centerY - radius * Math.cos(radians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  return [
    "M",
    start.x.toFixed(2),
    start.y.toFixed(2),
    "A",
    radius.toFixed(2),
    radius.toFixed(2),
    0,
    largeArcFlag,
    0,
    end.x.toFixed(2),
    end.y.toFixed(2),
  ].join(" ");
}

function normalizeValue(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return (value - min) / (max - min);
}

function valueToAngle(value: number, min: number, max: number) {
  const normalized = clamp(normalizeValue(value, min, max), 0, 1);
  return -90 + normalized * 180;
}

function formatTick(value: number, step: number) {
  if (step >= 1) return value.toFixed(0);
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  return value.toFixed(Math.min(3, Math.max(1, decimals)));
}

export function LiveGauge({
  value,
  unit,
  scale,
  ticks = DEFAULT_TICKS,
  zones = [],
  animation = DEFAULT_ANIMATION,
  valueBehavior = "clamp",
  className,
}: LiveGaugeProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const currentAngleRef = useRef<number>(-90);
  const targetAngleRef = useRef<number>(-90);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);

  const sanitizedZones = useMemo(() => {
    if (zones.length === 0) return [];

    const warnings: string[] = [];
    const filtered = zones
      .map((zone, index) => ({ ...zone, index }))
      .filter((zone) => {
        const valid =
          zone.from >= 0 &&
          zone.to <= 100 &&
          zone.from < zone.to &&
          Number.isFinite(zone.from) &&
          Number.isFinite(zone.to);
        if (!valid) {
          warnings.push(
            `LiveGauge: zone at index ${zone.index} has invalid range (${zone.from}-${zone.to}).`,
          );
        }
        return valid;
      })
      .sort((a, b) => a.from - b.from);

    for (let i = 1; i < filtered.length; i += 1) {
      if (filtered[i].from < filtered[i - 1].to) {
        warnings.push(
          `LiveGauge: zone at index ${filtered[i].index} overlaps another zone.`,
        );
        filtered.splice(i, 1);
        i -= 1;
      }
    }

    if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
      warnings.forEach((warning) => console.warn(warning));
    }

    return filtered;
  }, [zones]);

  const tickValues = useMemo(() => {
    if (ticks.step <= 0 || scale.max <= scale.min) return [];
    const values: number[] = [];
    const steps = Math.floor((scale.max - scale.min) / ticks.step);
    for (let i = 0; i <= steps; i += 1) {
      values.push(scale.min + i * ticks.step);
    }
    if (values[values.length - 1] !== scale.max) {
      values.push(scale.max);
    }
    return values;
  }, [scale.max, scale.min, ticks.step]);

  const updateNeedle = useCallback((angle: number) => {
    const needleLength = GAUGE_SIZE.radius - 12;
    const tip = polarToCartesian(
      GAUGE_SIZE.centerX,
      GAUGE_SIZE.centerY,
      needleLength,
      angle,
    );

    if (needleRef.current) {
      needleRef.current.setAttribute("x2", tip.x.toFixed(2));
      needleRef.current.setAttribute("y2", tip.y.toFixed(2));
    }
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const dt = Math.max((timestamp - lastTimestampRef.current) / 1000, 0);
      lastTimestampRef.current = timestamp;

      const currentAngle = currentAngleRef.current;
      const targetAngle = targetAngleRef.current;
      const diff = targetAngle - currentAngle;

      const maxStep = animation.maxSpeedDegPerSec * dt;
      let step = diff;

      if (animation.type === "spring") {
        step = diff * animation.stiffness;
      } else {
        const lerpFactor = Math.min(1, animation.stiffness);
        step = diff * lerpFactor;
      }

      if (Math.abs(step) > maxStep) {
        step = Math.sign(step) * maxStep;
      }

      const nextAngle = Math.abs(diff) < EPSILON ? targetAngle : currentAngle + step;
      currentAngleRef.current = nextAngle;
      updateNeedle(nextAngle);

      if (Math.abs(targetAngle - nextAngle) > EPSILON) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
        lastTimestampRef.current = null;
      }
    },
    [animation.maxSpeedDegPerSec, animation.stiffness, animation.type, updateNeedle],
  );

  const startAnimation = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setDisplayValue(null);
      return;
    }

    const min = scale.min;
    const max = scale.max;
    if (valueBehavior === "freeze" && (value < min || value > max)) {
      return;
    }

    const clampedValue = valueBehavior === "clamp" ? clamp(value, min, max) : value;
    const angle = valueToAngle(clampedValue, min, max);
    setDisplayValue(clampedValue);

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      currentAngleRef.current = angle;
      targetAngleRef.current = angle;
      updateNeedle(angle);
      return;
    }

    targetAngleRef.current = angle;
    startAnimation();
  }, [scale.max, scale.min, startAnimation, updateNeedle, value, valueBehavior]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const displayText =
    displayValue === null
      ? `--.-- ${unit}`
      : `${displayValue.toFixed(2)} ${unit}`;

  return (
    <div className={className}>
      <svg
        width={GAUGE_SIZE.width}
        height={GAUGE_SIZE.height}
        viewBox={`0 0 ${GAUGE_SIZE.width} ${GAUGE_SIZE.height}`}
        className="text-foreground"
        role="img"
        aria-label={`Gauge ${displayText}`}
      >
        <path
          d={describeArc(
            GAUGE_SIZE.centerX,
            GAUGE_SIZE.centerY,
            GAUGE_SIZE.radius,
            -90,
            90,
          )}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={10}
          fill="none"
        />
        {sanitizedZones.map((zone) => {
          const startAngle = -90 + (zone.from / 100) * 180;
          const endAngle = -90 + (zone.to / 100) * 180;
          return (
            <path
              key={`${zone.from}-${zone.to}-${zone.color}`}
              d={describeArc(
                GAUGE_SIZE.centerX,
                GAUGE_SIZE.centerY,
                GAUGE_SIZE.radius,
                startAngle,
                endAngle,
              )}
              stroke={zone.color}
              strokeWidth={10}
              fill="none"
            />
          );
        })}
        {tickValues.map((tickValue) => {
          const angle = valueToAngle(tickValue, scale.min, scale.max);
          const inner = polarToCartesian(
            GAUGE_SIZE.centerX,
            GAUGE_SIZE.centerY,
            GAUGE_SIZE.radius + 2,
            angle,
          );
          const outer = polarToCartesian(
            GAUGE_SIZE.centerX,
            GAUGE_SIZE.centerY,
            GAUGE_SIZE.radius + 10,
            angle,
          );
          const label = polarToCartesian(
            GAUGE_SIZE.centerX,
            GAUGE_SIZE.centerY,
            GAUGE_SIZE.radius + 22,
            angle,
          );
          return (
            <g key={`tick-${tickValue}`}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeOpacity={0.5}
                strokeWidth={1.5}
              />
              {ticks.showLabels && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.7}
                >
                  {formatTick(tickValue, ticks.step)}
                </text>
              )}
            </g>
          );
        })}
        <line
          ref={needleRef}
          x1={GAUGE_SIZE.centerX}
          y1={GAUGE_SIZE.centerY}
          x2={GAUGE_SIZE.centerX}
          y2={GAUGE_SIZE.centerY - GAUGE_SIZE.radius + 12}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle
          cx={GAUGE_SIZE.centerX}
          cy={GAUGE_SIZE.centerY}
          r={4}
          fill="currentColor"
        />
        <text
          x={GAUGE_SIZE.centerX}
          y={GAUGE_SIZE.centerY - 10}
          textAnchor="middle"
          fontSize={14}
          fill="currentColor"
          className="font-mono"
        >
          {displayText}
        </text>
      </svg>
    </div>
  );
}
