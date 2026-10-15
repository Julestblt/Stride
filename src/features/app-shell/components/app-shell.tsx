import { DataActivityProvider } from "@/features/data-activity/components/provider";
import { PullToSync } from "@/features/data-activity/components/pull-to-sync";
import {
  DataActivityStatus,
  DataActivityFeedback,
} from "@/features/data-activity/components/status";
import type { DataActivityObservation } from "@/features/data-activity/model";
import Link from "next/link";
import {
  ActivityIcon,
  ChartColumnIcon,
  FlagIcon,
  PlusIcon,
  TrendingUpIcon,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavGoalSwitcher, NavUser } from "@/components/stride/navigation";
import {
  shellRaceDate,
  type ShellAccount,
  type ShellAthlete,
  type ShellGoal,
  type ShellRaceLink,
} from "@/features/app-shell/shell";
import { PlanSidebarGroup } from "./plan-nav";
import type { ProgramNav } from "@/features/plans/view/program";
import { ProgressSidebarGroup } from "@/features/progress/components/progress-nav";
import { ShellNavItem } from "./shell-nav-item";
import { ShellRaceItem } from "./shell-race-item";
import { SignOutMenuItem } from "./sign-out-menu-item";
import { ShortcutHelp, ShortcutHelpMenuItem } from "./shortcut-help";
import {
  AccountMenuConnectionsIcon,
  AccountMenuPrivacyIcon,
  AccountMenuProfileIcon,
  AccountMenuSettingsIcon,
} from "./account-menu-icons";

export function AppShell({
  athlete,
  account,
  goal,
  races,
  sync,
  defaultOpen,
  initialActivity,
  planNav = null,
  children,
}: {
  athlete: ShellAthlete;
  account: ShellAccount;
  goal: ShellGoal | null;
  races: ShellRaceLink[];
  sync: string | null;
  initialActivity?: DataActivityObservation | null;
  planNav?: ProgramNav | null;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <DataActivityProvider initial={initialActivity}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="h-svh overflow-hidden print:h-auto print:overflow-visible"
      >
        <ShortcutHelp />
        <Sidebar variant="inset" collapsible="icon" className="print:hidden">
          <SidebarHeader>
            <NavGoalSwitcher
              name={goal?.name ?? "Stride"}
              detail={goal?.detail ?? "Aucun objectif"}
            >
              <DropdownMenuContent className="w-60" align="start">
                <DropdownMenuLabel>Objectif</DropdownMenuLabel>
                <p className="px-2 pb-2 text-sm text-foreground">
                  {goal ? `${goal.name} · ${goal.detail}` : "Aucun objectif"}
                </p>
              </DropdownMenuContent>
            </NavGoalSwitcher>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Entraînement</SidebarGroupLabel>
              <SidebarMenu>
                <ShellNavItem
                  href="/plan"
                  icon={<ChartColumnIcon />}
                  label="Plan"
                />
                <ShellNavItem
                  href="/activities"
                  icon={<ActivityIcon />}
                  label="Activités"
                />
                <ShellNavItem
                  href="/progress"
                  icon={<TrendingUpIcon />}
                  label="Progression"
                />
                <ShellNavItem
                  href="/races"
                  icon={<FlagIcon />}
                  label="Courses"
                />
              </SidebarMenu>
            </SidebarGroup>
            <PlanSidebarGroup nav={planNav} />
            <ProgressSidebarGroup />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Objectifs</SidebarGroupLabel>
              <SidebarMenu>
                {races.map((race) => (
                  <ShellRaceItem
                    key={race.id}
                    id={race.id}
                    name={race.name}
                    priority={race.priority}
                    date={shellRaceDate(race.date)}
                  />
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    className="min-h-7.5 gap-2 text-meta text-muted-foreground"
                  >
                    <Link href="/settings/goals">
                      <PlusIcon className="size-3.5" />
                      Ajouter une course
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <DataActivityStatus
              compact
              className="hidden justify-center group-data-[collapsible=icon]:flex"
            />
            <NavUser
              name={athlete.name}
              detail="Athlète"
              initials={athlete.initials}
              sync={
                initialActivity !== undefined ? (
                  <DataActivityStatus />
                ) : sync ? (
                  `Garmin ${sync.toLowerCase()}`
                ) : undefined
              }
              syncDot={initialActivity === undefined}
            >
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-60 gap-px rounded-surface border border-border-strong bg-popover p-1.5"
                side="top"
                align="start"
              >
                <div className="mb-1 flex items-center gap-2.5 border-b border-border-strong px-2.5 pt-2 pb-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-control bg-border-strong text-xs font-semibold"
                  >
                    {athlete.initials}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {athlete.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {athlete.detail}
                    </span>
                  </span>
                </div>
                <DropdownMenuItem
                  asChild
                  className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
                >
                  <Link href="/settings/profile">
                    <AccountMenuProfileIcon />
                    Profil
                    <span className="ml-auto text-xs text-muted-foreground">
                      {account.profilePercent}%
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
                >
                  <Link href="/settings">
                    <AccountMenuSettingsIcon />
                    Réglages
                    <DropdownMenuShortcut className="max-md:hidden">
                      ⌘,
                    </DropdownMenuShortcut>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
                >
                  <Link href="/settings/connections">
                    <AccountMenuConnectionsIcon />
                    Connexions
                    {account.garminSince && (
                      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-success" />
                        Garmin · {account.garminSince}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
                >
                  <Link href="/settings/privacy">
                    <AccountMenuPrivacyIcon />
                    Données et confidentialité
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border-strong" />
                <ShortcutHelpMenuItem />
                <SignOutMenuItem />
              </DropdownMenuContent>
            </NavUser>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="relative h-svh min-h-0 overflow-hidden md:h-[calc(100svh-1rem)] print:h-auto print:overflow-visible md:print:h-auto">
          <DataActivityFeedback />
          <PullToSync>{children}</PullToSync>
        </SidebarInset>
      </SidebarProvider>
    </DataActivityProvider>
  );
}
