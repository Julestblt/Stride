import { cookies } from "next/headers";
import Link from "next/link";
import {
  ActivityIcon,
  ChartNoAxesColumnIcon,
  CircleDotIcon,
  FlagIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  MobileAskAction,
  MobileTab,
  MobileTabBar,
} from "@/components/stride/mobile-tab-bar";
import {
  NavBadge,
  NavDayRow,
  NavGoalSwitcher,
  NavItem,
  NavUser,
} from "@/components/stride/navigation";
import { StrideMark } from "@/components/stride/stride-mark";
import { SyncStatus } from "@/components/stride/sync-status";

const shell = "/design-system/shell";

export default async function ShellPage() {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <NavGoalSwitcher
            name="EcoTrail Paris 120K"
            detail="A race · 164 days"
          >
            <DropdownMenuContent className="w-60" align="start">
              <DropdownMenuLabel>Goals</DropdownMenuLabel>
              <DropdownMenuItem>EcoTrail Paris 120K</DropdownMenuItem>
              <DropdownMenuItem>10K tune-up</DropdownMenuItem>
            </DropdownMenuContent>
          </NavGoalSwitcher>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Training</SidebarGroupLabel>
            <SidebarMenu>
              <NavItem
                href={shell}
                icon={<CircleDotIcon />}
                label="Today"
                isActive
                attention
                badge={
                  <NavBadge kind="value" tone="warning">
                    58
                  </NavBadge>
                }
              />
              <NavItem
                href={`${shell}#coach`}
                icon={<StrideMark className="stroke-current" />}
                label="Coach"
                attention
                badge={<NavBadge kind="count">2</NavBadge>}
              />
              <NavItem
                href={`${shell}#plan`}
                icon={<ChartNoAxesColumnIcon />}
                label="Plan"
              />
              <NavItem
                href={`${shell}#activities`}
                icon={<ActivityIcon />}
                label="Activities"
              />
              <NavItem
                href={`${shell}#progress`}
                icon={<TrendingUpIcon />}
                label="Progress"
              />
              <NavItem
                href={`${shell}#races`}
                icon={<FlagIcon />}
                label="Races"
              />
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>This week</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <NavDayRow
                href={`${shell}#tue`}
                day="Tue 6"
                label="Easy 50'"
                zone={2}
                status="done"
              />
              <NavDayRow
                href={`${shell}#wed`}
                day="Wed 7"
                label="Threshold 52'"
                zone={4}
                isToday
                status="attention"
              />
              <NavDayRow
                href={`${shell}#thu`}
                day="Thu 8"
                label="Easy 45'"
                zone={2}
              />
              <NavDayRow
                href={`${shell}#sun`}
                day="Sun 11"
                label="Long trail 2h20"
                zone={1}
              />
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            name="Jules"
            detail="Profile 72% · 2 questions"
            initials="JT"
            sync="Garmin synced 06:12"
          >
            <DropdownMenuContent className="w-56" side="top" align="start">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Answer 2 questions</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </NavUser>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh pb-24 md:min-h-[calc(100svh-1rem)] md:pb-0">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-center"
          />
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm"
          >
            <Link
              href="/design-system"
              className="text-muted-foreground hover:text-foreground"
            >
              Design system
            </Link>
            <span aria-hidden="true" className="text-dim">
              /
            </span>
            <span aria-current="page">App shell</span>
          </nav>
        </header>
        <div className="flex max-w-3xl flex-col gap-6 p-5 sm:p-10">
          <MonoLabel>Wed 7 Oct · Rebuild · Week 2</MonoLabel>
          <h1 className="text-headline font-semibold text-balance sm:text-display">
            A sidebar that carries context, not just links.
          </h1>
          <p className="text-body text-pretty text-muted">
            Expanded at 264 px with an inset work area. Press{" "}
            <kbd className="font-mono text-xs">⌘B</kbd> or use the trigger to
            collapse to the 56 px icon rail, where badges become dots and labels
            move to tooltips. Below 768 px the sidebar becomes a sheet and the
            bottom tabs keep daily use one thumb away.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge>Sidebar · inset</Badge>
            <Badge>collapsible=&quot;icon&quot;</Badge>
            <Badge>Sheet on mobile</Badge>
          </div>
          <SyncStatus state="importing" progress={71}>
            Importing from Garmin · now at 2020
          </SyncStatus>
        </div>
      </SidebarInset>
      <MobileTabBar className="fixed inset-x-0 bottom-0 z-20 md:hidden">
        <MobileTab href={shell} icon={<CircleDotIcon />} label="Aujourd’hui" />
        <MobileTab
          href={`${shell}#plan`}
          icon={<ChartNoAxesColumnIcon />}
          label="Plan"
        />
        <MobileAskAction
          href={`${shell}#coach`}
          label="Coach, 2 questions en attente"
          isActive
          badge={
            <NavBadge
              kind="count"
              className="-top-1 -right-1 translate-y-0 ring-2 ring-background"
            >
              <span aria-hidden="true">2</span>
            </NavBadge>
          }
        />
        <MobileTab
          href={`${shell}#activities`}
          icon={<ActivityIcon />}
          label="Activités"
        />
        <MobileTab
          href={`${shell}#progress`}
          icon={<TrendingUpIcon />}
          label="Progression"
        />
      </MobileTabBar>
    </SidebarProvider>
  );
}
