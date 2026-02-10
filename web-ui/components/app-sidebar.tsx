"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ChevronRightCircle,
  Focus,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveGauge } from "@/components/live-gauge";
import { PositionBarGauge } from "@/components/position-bar-gauge";
import { useElevatorData } from "@/components/elevator-data-provider";

export function AppSidebar() {
  const { toggleSidebar } = useSidebar();
  const { theme, setTheme } = useTheme();
  const {
    samples,
    autoScroll,
    isRunning,
    toggleRunning,
    windowSeconds,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    resumeAutoScroll,
    resetChart,
  } = useElevatorData();

  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;

  const currentPosition = latestSample?.position_mm ?? 0;
  const currentSpeed = latestSample?.velocity_mm_s ?? 0;

  const currentFloor = currentPosition >= 5000 ? "OG" : "EG";
  return (
    <Sidebar side="left" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarGroup className="p-0">
            <SidebarGroupLabel>App-Controls</SidebarGroupLabel>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleSidebar}>
                <ChevronRightCircle />
                <span>Toggle Sidebar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                <span>Toggle theme</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarGroup>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-3 py-2">
              <div className="bg-sidebar-accent/40 rounded-lg border p-3">
                <div className="flex flex-col items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    Floor {currentFloor}
                  </Badge>
                  <PositionBarGauge
                    value={Math.abs(currentPosition / 1000)}
                    height={140}
                  />
                  <Badge variant="outline" className="text-xs">
                    {Math.abs(currentPosition / 1000).toFixed(2)} m
                  </Badge>
                </div>
              </div>
              <div className="bg-sidebar-accent/40 rounded-lg border p-3">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-muted-foreground text-sm">Speed</p>
                  <p className="font-mono text-sm">
                    {Math.abs(currentSpeed / 1000).toFixed(2)} m/s
                  </p>
                  <LiveGauge
                    name="Speed"
                    value={Math.abs(currentSpeed / 1000)}
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
              </div>
              {/*

              <div className="rounded-lg border bg-sidebar-accent/40 p-3">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-muted-foreground">Acceleration</p>
                  <Badge variant="secondary" className="font-mono">
                    {Math.abs(currentAcceleration / 1000).toFixed(2)} m/s²
                  </Badge>
                </div>
              </div>
              */}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Chart Controls</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-2 py-2">
              {!autoScroll && (
                <Badge variant="destructive" className="text-xs">
                  Auto-scroll paused
                </Badge>
              )}
              <div className="bg-sidebar-accent/40 rounded-lg border p-3">
                <div className="flex flex-col gap-2">
                  {!autoScroll && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resumeAutoScroll}
                      className="w-full justify-start gap-2 bg-transparent outline-2 outline-green-500 outline-solid"
                    >
                      <Focus className="h-4 w-4" />
                      Resume auto-scroll
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={zoomIn}
                      disabled={!canZoomIn}
                      title="Zoom in (show less time)"
                      className="h-8 w-8"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="bg-sidebar-accent/30 flex-1 rounded-md border px-2 py-1 text-center font-mono text-xs">
                      {windowSeconds}s window
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={zoomOut}
                      disabled={!canZoomOut}
                      title="Zoom out (show more time)"
                      className="h-8 w-8"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleRunning}
                    title={isRunning ? "Pause data" : "Resume data"}
                    className="w-full justify-start gap-2"
                  >
                    {isRunning ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isRunning ? "Pause data" : "Resume data"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetChart}
                    title="Reset chart"
                    className="w-full justify-start gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset chart
                  </Button>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
