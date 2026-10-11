import Link from "next/link";
import { ActivityIcon, FlagIcon, PlusIcon } from "lucide-react";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavGoalSwitcher, NavUser } from "@/components/stride/navigation";
import {
  shellRaceDate,
  type ShellAthlete,
  type ShellGoal,
  type ShellRaceLink,
} from "@/features/app-shell/shell";
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
  goal,
  races,
  sync,
  defaultOpen,
  children,
}: {
  athlete: ShellAthlete;
  goal: ShellGoal | null;
  races: ShellRaceLink[];
  sync: string | null;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
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
                href="/activities"
                icon={<ActivityIcon />}
                label="Activités"
              />
              <ShellNavItem href="/races" icon={<FlagIcon />} label="Courses" />
            </SidebarMenu>
          </SidebarGroup>
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
          <NavUser
            name={athlete.name}
            detail={athlete.detail}
            initials={athlete.initials}
            sync={sync ? `Garmin ${sync.toLowerCase()}` : undefined}
          >
            <DropdownMenuContent className="w-56" side="top" align="start">
              <DropdownMenuLabel>Compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <AccountMenuProfileIcon />
                  Profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <AccountMenuSettingsIcon />
                  Réglages
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/connections">
                  <AccountMenuConnectionsIcon />
                  Connexions
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/privacy">
                  <AccountMenuPrivacyIcon />
                  Données et confidentialité
                </Link>
              </DropdownMenuItem>
              <ShortcutHelpMenuItem />
              <DropdownMenuSeparator />
              <SignOutMenuItem />
            </DropdownMenuContent>
          </NavUser>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="h-svh min-h-0 overflow-hidden md:h-[calc(100svh-1rem)] print:h-auto print:overflow-visible md:print:h-auto">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
