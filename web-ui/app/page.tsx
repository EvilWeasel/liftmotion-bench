"use client";

import { LiveChart } from "@/components/live-chart";
import { useElevatorData } from "@/components/elevator-data-provider";

export default function Home() {
  const { samples } = useElevatorData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <LiveChart samples={samples} />
    </div>
  );
}
