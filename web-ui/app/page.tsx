"use client";

import { LiveChart } from "@/components/live-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocketElevatorData } from "@/hooks/useWebSocketElevatorData";

export default function Home() {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";
  const { samples, isRunning, toggleRunning, reset } = useWebSocketElevatorData(WS_URL);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Elevator Sensor Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time position monitoring • {samples.length.toLocaleString()} samples
            </p>
          </div>
          <ThemeToggle />
        </header>

        <LiveChart
          samples={samples}
          isRunning={isRunning}
          onToggleRunning={toggleRunning}
          onReset={reset}
        />

        <footer className="text-center text-xs text-muted-foreground">
          Data updates every 20ms • Drag chart to view history • Click &quot;Live&quot; to resume auto-scroll
        </footer>
      </div>
    </main>
  );
}
