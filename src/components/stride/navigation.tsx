import Link from "next/link";
import { ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { StrideMark } from "@/components/stride/stride-mark";
import { zoneFills } from "@/components/stride/session-shape";
import type { Zone } from "@/components/stride/session-blocks";

export function NavGoalSwitcher({
  name,
  detail,
  children,
}: {
  name: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="gap-2.5 px-1.5"
            >
              <span className="grid size-7.5 shrink-0 place-items-center rounded-control bg-accent">
                <StrideMark className="stroke-accent-foreground" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-meta leading-tight font-semibold text-foreground">
                  {name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {detail}
                </span>
              </span>
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {children}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavBadge({
  kind,
  tone = "muted",
  children,
}: {
  kind: "value" | "count";
  tone?: "muted" | "warning";
  children: React.ReactNode;
}) {
  return (
    <SidebarMenuBadge
      data-kind={kind}
      className={cn(
        kind === "value" && "font-metric text-body font-semibold tabular-nums",
        kind === "value" &&
          (tone === "warning" ? "text-warning" : "text-muted-foreground"),
        kind === "count" &&
          "right-2 h-4.5 min-w-4.5 rounded-full bg-warning px-1 text-label font-semibold tracking-normal text-background",
      )}
    >
      {children}
    </SidebarMenuBadge>
  );
}

export function NavItem({
  href,
  icon,
  label,
  isActive = false,
  badge,
  attention = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  badge?: React.ReactNode;
  attention?: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={label}
        className="relative [&>svg]:text-muted-foreground data-[active=true]:[&>svg]:text-accent"
      >
        <Link href={href} aria-current={isActive ? "page" : undefined}>
          {icon}
          <span>{label}</span>
          {attention && (
            <PulseDot
              tone="warning"
              breathing={false}
              className="absolute top-1.5 right-1.5 hidden group-data-[collapsible=icon]:block"
            />
          )}
        </Link>
      </SidebarMenuButton>
      {badge}
    </SidebarMenuItem>
  );
}

export function NavDayRow({
  href,
  day,
  label,
  zone,
  isToday = false,
  status,
}: {
  href: string;
  day: string;
  label: string;
  zone: Zone;
  isToday?: boolean;
  status?: "done" | "attention";
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="sm"
        isActive={isToday}
        className="grid min-h-7 grid-cols-[3px_2.625rem_minmax(0,1fr)_0.75rem] gap-2 text-xs data-[active=true]:bg-surface"
      >
        <Link href={href} aria-current={isToday ? "date" : undefined}>
          <span
            aria-hidden="true"
            className={cn("h-3 w-0.75", zoneFills[zone])}
          />
          <MonoLabel size="nano" tone={isToday ? "accent" : "muted"}>
            {day}
          </MonoLabel>
          <span className="truncate text-foreground">{label}</span>
          <span className="grid place-items-center">
            {status === "attention" && (
              <>
                <PulseDot tone="warning" />
                <span className="sr-only">Needs you</span>
              </>
            )}
            {status === "done" && (
              <>
                <span aria-hidden="true" className="text-muted">
                  ✓
                </span>
                <span className="sr-only">Done</span>
              </>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavUser({
  name,
  detail,
  initials,
  sync,
  syncDot = true,
  children,
}: {
  name: string;
  detail: string;
  initials: string;
  sync?: React.ReactNode;
  syncDot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarMenu>
      {sync && (
        <li className="flex items-center gap-2 px-2.5 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {syncDot && <PulseDot tone="success" breathing={false} />}
          {sync}
        </li>
      )}
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="gap-2.5 px-1.5"
            >
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-control bg-border text-xs font-semibold text-foreground"
              >
                {initials}
              </span>
              <span className="flex min-w-0 flex-col text-left">
                <span className="truncate text-meta leading-tight font-semibold text-foreground">
                  {name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {detail}
                </span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {children}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
