"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export const progressSections = [
  { href: "/progress", label: "Forme" },
] as const;

function useSection() {
  const pathname = usePathname();
  return (
    [...progressSections]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (section) =>
          pathname === section.href || pathname.startsWith(`${section.href}/`),
      ) ?? progressSections[0]
  );
}

function useHref(href: string) {
  const period = useSearchParams().get("period");
  return period ? `${href}?period=${encodeURIComponent(period)}` : href;
}

function SectionLink({
  href,
  current,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
  current: boolean;
}) {
  return (
    <Link
      href={useHref(href)}
      aria-current={current ? "page" : undefined}
      {...props}
    />
  );
}

export function ProgressBreadcrumb() {
  const section = useSection();
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="flex min-w-0 flex-1 items-center gap-2 text-sm"
    >
      <span className="text-muted-foreground">Progression</span>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      <span aria-current="page" className="truncate">
        {section.label}
      </span>
    </nav>
  );
}

export function ProgressTabs() {
  const section = useSection();
  return (
    <>
      <nav
        aria-label="Sections de la progression"
        className="flex gap-0.5 rounded-[11px] border border-border bg-surface p-0.75 sm:hidden"
      >
        {progressSections.map((item) => (
          <SectionLink
            key={item.href}
            href={item.href}
            current={item.href === section.href}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-surface text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              item.href === section.href &&
                "bg-border font-semibold text-foreground",
            )}
          >
            {item.label}
          </SectionLink>
        ))}
      </nav>
      <nav
        aria-label="Sections de la progression"
        className="flex gap-5 text-sm max-sm:hidden"
      >
        {progressSections.map((item) => (
          <SectionLink
            key={item.href}
            href={item.href}
            current={item.href === section.href}
            className={cn(
              "border-b-2 border-transparent py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              item.href === section.href && "border-accent text-foreground",
            )}
          >
            {item.label}
          </SectionLink>
        ))}
      </nav>
    </>
  );
}

export function ProgressSidebarGroup() {
  const pathname = usePathname();
  const section = useSection();
  if (pathname !== "/progress" && !pathname.startsWith("/progress/"))
    return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Progression</SidebarGroupLabel>
      <SidebarMenu>
        {progressSections.map((item) => {
          const current = item.href === section.href;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={current}
                className="min-h-7.5 gap-2 text-meta data-[active=true]:font-semibold"
              >
                <SectionLink href={item.href} current={current}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1 shrink-0 rounded-full",
                      current ? "bg-accent" : "bg-border-strong",
                    )}
                  />
                  {item.label}
                </SectionLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
