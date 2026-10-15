"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronRightIcon, ListIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import type {
  ProgramNav,
  ProgramNavBlock,
} from "@/features/plans/view/program";

function weekHref(weekStart: string) {
  return `/plan?week=${weekStart}`;
}

function BlockItem({
  block,
  selected,
}: {
  block: ProgramNavBlock;
  selected: string | null;
}) {
  const [open, setOpen] = useState(
    block.status === "current" ||
      block.weeks.some((week) => week.weekStart === selected),
  );
  const id = `plan-nav-${block.blockKey}`;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn("min-h-7.5 gap-2 text-meta", open && "text-foreground")}
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-200 ease-stride",
            open && "rotate-90",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-mark",
            block.status === "current"
              ? "bg-accent"
              : block.status === "past"
                ? "bg-success"
                : "bg-border-strong",
          )}
        />
        <span className="truncate">{block.name}</span>
        <MonoLabel size="nano" className="ml-auto">
          {block.months}
        </MonoLabel>
      </SidebarMenuButton>
      <SidebarMenuSub id={id} hidden={!open} className="mr-0 ml-5 gap-px">
        {block.weeks.map((week) => {
          const active = week.weekStart === selected;
          return (
            <SidebarMenuSubItem key={week.weekStart}>
              <SidebarMenuSubButton
                asChild
                size="sm"
                isActive={active}
                className="h-7.5 gap-2 text-meta"
              >
                <Link
                  href={weekHref(week.weekStart)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="min-w-0 flex-1 truncate">{week.label}</span>
                  <span
                    className={cn(
                      "font-metric text-sm font-semibold tabular-nums",
                      week.status === "current"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {week.duration}
                  </span>
                  <span className="grid w-3 place-items-center">
                    {week.proposed ? (
                      <>
                        <PulseDot tone="warning" breathing={false} />
                        <span className="sr-only">Changement proposé</span>
                      </>
                    ) : week.status === "current" ? (
                      <>
                        <PulseDot breathing={false} />
                        <span className="sr-only">Semaine en cours</span>
                      </>
                    ) : week.status === "past" ? (
                      <>
                        <CheckIcon
                          aria-hidden="true"
                          className="size-3 text-success"
                          strokeWidth={2.5}
                        />
                        <span className="sr-only">Semaine passée</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

export function PlanSidebarGroup({ nav }: { nav: ProgramNav | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (!nav || (pathname !== "/plan" && !pathname.startsWith("/plan/")))
    return null;
  const week = params.get("week");
  const overview = pathname === "/plan" && !week && !params.get("race");
  const selected = pathname === "/plan" ? week : null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Blocs</SidebarGroupLabel>
      <SidebarMenu className="gap-px">
        <SidebarMenuItem className="mb-1">
          <SidebarMenuButton
            asChild
            size="sm"
            isActive={overview}
            className="min-h-7.5 gap-2 text-meta data-[active=true]:font-semibold"
          >
            <Link href="/plan" aria-current={overview ? "page" : undefined}>
              <ListIcon aria-hidden="true" className="size-3.5" />
              <span className="flex-1">Programme complet</span>
              <span className="font-metric text-sm font-normal text-muted-foreground tabular-nums">
                {nav.weekCount}
                <span className="sr-only"> semaines</span>
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {nav.blocks.map((block) => (
          <BlockItem key={block.blockKey} block={block} selected={selected} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
