"use client";

import { usePathname } from "next/navigation";
import {
  RouteError,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";
import { appSectionLabel } from "@/features/app-shell/route-state";

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <RouteStateFrame section={appSectionLabel(usePathname())}>
      <RouteError retry={retry} />
    </RouteStateFrame>
  );
}
