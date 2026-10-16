"use client";

import { usePathname } from "next/navigation";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function CoachSidebarGroup() {
  const pathname = usePathname();
  if (pathname !== "/coach" && !pathname.startsWith("/coach/")) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Coach</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="sm"
            isActive
            className="min-h-7.5 gap-2 text-meta data-[active=true]:font-semibold"
          >
            <Link
              href="/coach"
              aria-current={pathname === "/coach" ? "page" : undefined}
            >
              <span
                aria-hidden="true"
                className="size-1 shrink-0 rounded-full bg-accent"
              />
              Conversations
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
