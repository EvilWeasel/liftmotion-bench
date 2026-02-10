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
import { ChevronRightCircle, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { LiveGauge } from "@/components/live-gauge";
import { PositionBarGauge } from "@/components/position-bar-gauge";
import { useElevatorData } from "@/components/elevator-data-provider";

export function AppSidebar() {
  const { toggleSidebar } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { samples, autoScroll } = useElevatorData();

  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;

  const currentPosition = latestSample?.position_mm ?? 0;
  const currentSpeed = latestSample?.velocity_mm_s ?? 0;

  const currentFloor = currentPosition >= 5000 ? "OG" : "EG";
  return (
    <Sidebar side="left" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
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
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span>Toggle theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex flex-col items-center gap-1">
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
              <div className="flex flex-col items-center gap-1">
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
              {/*

              <div className="flex flex-col items-center gap-1">
                <p className="text-muted-foreground">Acceleration</p>
                <Badge variant="secondary" className="font-mono">
                  {Math.abs(currentAcceleration / 1000).toFixed(2)} m/s²
                </Badge>
              </div>
              */}

              {!autoScroll && (
                <Badge variant="destructive" className="text-xs">
                  Auto-scroll paused
                </Badge>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
