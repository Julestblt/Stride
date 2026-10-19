"use client";

import { usePathname } from "next/navigation";
import {
  TabActivitiesIcon,
  TabPlanIcon,
  TabProgressIcon,
  TabTodayIcon,
} from "@/components/stride/nav-icons";
import {
  MobileAskAction,
  MobileTab,
  MobileTabBar,
} from "@/components/stride/mobile-tab-bar";
import { NavBadge } from "@/components/stride/navigation";
import { isActivePath, mobileTabBarVisible } from "../mobile-nav";
import {
  coachActionLabel,
  coachWaiting,
  type CoachAttention,
} from "../coach-attention";

export function AppMobileTabBar({
  attention,
}: {
  attention: CoachAttention | null;
}) {
  const pathname = usePathname();
  if (!mobileTabBarVisible(pathname)) return null;
  const waiting = coachWaiting(attention);
  const tab = (href: string, icon: React.ReactNode, label: string) => (
    <MobileTab
      href={href}
      icon={icon}
      label={label}
      isActive={isActivePath(pathname, href)}
    />
  );
  return (
    <MobileTabBar className="relative z-10 shrink-0 md:hidden print:hidden">
      {tab("/today", <TabTodayIcon />, "Aujourd’hui")}
      {tab("/plan", <TabPlanIcon />, "Plan")}
      <MobileAskAction
        href="/coach"
        label={coachActionLabel(attention)}
        isActive={isActivePath(pathname, "/coach")}
        badge={
          waiting > 0 ? (
            <NavBadge
              kind="count"
              className="-top-1 -right-1 translate-y-0 ring-2 ring-background"
            >
              <span aria-hidden="true">{waiting}</span>
            </NavBadge>
          ) : undefined
        }
      />
      {tab("/activities", <TabActivitiesIcon />, "Activités")}
      {tab("/progress", <TabProgressIcon />, "Progression")}
    </MobileTabBar>
  );
}
