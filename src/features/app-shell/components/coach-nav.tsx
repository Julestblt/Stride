"use client";

import { usePathname } from "next/navigation";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { NavBadge, NavItem } from "@/components/stride/navigation";
import { StrideMark } from "@/components/stride/stride-mark";
import { StaffStack } from "@/features/coach/components/staff-portrait";
import { staffAgents } from "@/features/coach/staff";
import {
  coachAttentionLabel,
  coachWaiting,
  type CoachAttention,
} from "../coach-attention";

const subClass =
  "min-h-7.5 pl-4 text-meta text-muted-foreground data-[active=true]:bg-transparent data-[active=true]:text-foreground";

export function CoachNavItem({
  attention,
}: {
  attention: CoachAttention | null;
}) {
  const pathname = usePathname();
  const active = pathname === "/coach" || pathname.startsWith("/coach/");
  const team = pathname === "/coach/equipe";
  const waiting = coachWaiting(attention);
  return (
    <NavItem
      href="/coach"
      icon={<StrideMark className="stroke-current" strokeWidth="1.8" />}
      label="Coach"
      isActive={active}
      attention={waiting > 0}
      badge={
        attention && waiting > 0 ? (
          <NavBadge kind="count" className="top-4">
            <span aria-hidden="true">{waiting}</span>
            <span className="sr-only">{coachAttentionLabel(attention)}</span>
          </NavBadge>
        ) : undefined
      }
    >
      {active && (
        <SidebarMenuSub className="mx-0 ml-5 gap-px border-l-0 px-0 py-0.5">
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={!team} className={subClass}>
              <Link href="/coach" aria-current={team ? undefined : "page"}>
                Conversations
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={team} className={subClass}>
              <Link
                href="/coach/equipe"
                aria-current={team ? "page" : undefined}
              >
                L’équipe
                <StaffStack
                  agents={staffAgents}
                  size={16}
                  className="ml-auto"
                />
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </NavItem>
  );
}
