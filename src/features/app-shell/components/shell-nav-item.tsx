"use client";

import { usePathname } from "next/navigation";
import { NavItem } from "@/components/stride/navigation";

export function ShellNavItem({
  href,
  icon,
  label,
  badge,
  attention = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  attention?: boolean;
}) {
  const pathname = usePathname();
  return (
    <NavItem
      href={href}
      icon={icon}
      label={label}
      badge={badge}
      attention={attention}
      isActive={pathname === href || pathname.startsWith(`${href}/`)}
    />
  );
}
