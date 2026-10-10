import { ActivityIcon } from "lucide-react";
import {
  DropdownMenuContent,
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
} from "@/components/ui/sidebar";
import { NavGoalSwitcher, NavUser } from "@/components/stride/navigation";
import type { ShellAthlete, ShellGoal } from "@/features/app-shell/shell";
import { ShellNavItem } from "./shell-nav-item";
import { SignOutMenuItem } from "./sign-out-menu-item";

export function AppShell({
  athlete,
  goal,
  sync,
  defaultOpen,
  children,
}: {
  athlete: ShellAthlete;
  goal: ShellGoal | null;
  sync: string | null;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh overflow-hidden"
    >
      <Sidebar variant="inset" collapsible="icon">
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
              <SignOutMenuItem />
            </DropdownMenuContent>
          </NavUser>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="h-svh min-h-0 overflow-hidden md:h-[calc(100svh-1rem)]">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
