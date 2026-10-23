"use client";

import { useDataActivity } from "@/features/data-activity/components/provider";
import { shortSince } from "../shell";

export function GarminSince() {
  const activity = useDataActivity();
  const since = shortSince(
    activity?.observation?.sync.lastSyncAt ?? null,
    new Date(),
  );
  if (!since) return null;
  return (
    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-success" />
      Garmin · {since}
    </span>
  );
}
