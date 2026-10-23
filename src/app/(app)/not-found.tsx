"use client";

import { usePathname } from "next/navigation";
import {
  RouteNotFound,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";
import { appSectionLabel } from "@/features/app-shell/route-state";

export default function AppNotFound() {
  return (
    <RouteStateFrame section={appSectionLabel(usePathname())}>
      <RouteNotFound item="page" />
    </RouteStateFrame>
  );
}
