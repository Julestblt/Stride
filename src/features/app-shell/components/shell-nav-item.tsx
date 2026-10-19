"use client";

import { usePathname } from "next/navigation";
import { NavBadge, NavItem } from "@/components/stride/navigation";
import type { ShellBadge } from "../shell";

export function ShellNavItem({
  href,
  icon,
  label,
  badge = null,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: ShellBadge | null;
}) {
  const pathname = usePathname();
  return (
    <NavItem
      href={href}
      icon={icon}
      label={label}
      isActive={pathname === href || pathname.startsWith(`${href}/`)}
      attention={badge?.attention}
      badge={
        badge ? (
          <NavBadge kind="value" tone={badge.attention ? "warning" : "muted"}>
            <span aria-hidden="true">{badge.value}</span>
            <span className="sr-only">{badge.label}</span>
          </NavBadge>
        ) : undefined
      }
    />
  );
}
