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

const subClass =
  "min-h-7.5 pl-4 text-meta text-muted-foreground data-[active=true]:bg-transparent data-[active=true]:text-foreground";

export type CoachAttention = { questions: number; proposals: number };

function count(value: number, one: string, many: string) {
  if (value === 0) return null;
  return value === 1 ? `1 ${one}` : `${value} ${many}`;
}

export function coachAttentionLabel(attention: CoachAttention) {
  const parts = [
    count(attention.questions, "question", "questions"),
    count(attention.proposals, "proposition", "propositions"),
  ].filter(Boolean);
  return `${parts.join(" et ")} en attente`;
}

export function CoachNavItem({
  attention,
}: {
  attention: CoachAttention | null;
}) {
  const pathname = usePathname();
  const active = pathname === "/coach" || pathname.startsWith("/coach/");
  const team = pathname === "/coach/equipe";
  const waiting = attention ? attention.questions + attention.proposals : 0;
  return (
    <NavItem
      href="/coach"
      icon={<StrideMark className="stroke-current" />}
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
                  agents={["coach", "medical"]}
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
