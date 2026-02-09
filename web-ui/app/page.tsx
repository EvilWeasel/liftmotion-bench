"use client";

import { LiveChart } from "@/components/live-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocketElevatorData } from "@/hooks/useWebSocketElevatorData";

export default function Home() {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";
  const { samples, isRunning, toggleRunning, reset } =
    useWebSocketElevatorData(WS_URL);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Real-time position monitoring • {samples.length.toLocaleString()}{" "}
        samples
      </p>
      <LiveChart
        samples={samples}
        isRunning={isRunning}
        onToggleRunning={toggleRunning}
        onReset={reset}
      />
    </div>
  );
}
