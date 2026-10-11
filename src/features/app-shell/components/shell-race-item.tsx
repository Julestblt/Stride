"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { MonoLabel } from "@/components/stride/mono-label";

export function ShellRaceItem({
  id,
  name,
  priority,
  date,
}: {
  id: string;
  name: string;
  priority: string;
  date: string | null;
}) {
  const pathname = usePathname();
  const href = `/races/${id}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="sm"
        isActive={active}
        tooltip={name}
        className="min-h-7.5 gap-2 text-meta data-[active=true]:font-semibold"
      >
        <Link href={href} aria-current={active ? "page" : undefined}>
          <MonoLabel
            size="micro"
            tone={active ? "accent" : "muted"}
            className="w-3.5 shrink-0"
          >
            {priority}
          </MonoLabel>
          <span className="truncate">{name}</span>
          {date && (
            <MonoLabel size="micro" className="ml-auto shrink-0">
              {date}
            </MonoLabel>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
