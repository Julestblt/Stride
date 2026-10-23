"use client";

import { RouteError } from "@/features/app-shell/components/route-state";

export default function SettingsError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-full flex-col px-1 py-6 md:items-center md:justify-center md:py-12">
      <RouteError retry={retry} />
    </div>
  );
}
