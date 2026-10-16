"use client";

import { usePathname } from "next/navigation";
import { NavItem } from "@/components/stride/navigation";

export function ShellNavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <NavItem
      href={href}
      icon={icon}
      label={label}
      isActive={pathname === href || pathname.startsWith(`${href}/`)}
    />
  );
}
