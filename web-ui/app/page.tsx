"use client";

import { LiveChart } from "@/components/live-chart";
import { useElevatorData } from "@/components/elevator-data-provider";

export default function Home() {
  const { samples } = useElevatorData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Real-time position monitoring • {samples.length.toLocaleString()}{" "}
        samples
      </p>
      <LiveChart samples={samples} />
    </div>
  );
}
