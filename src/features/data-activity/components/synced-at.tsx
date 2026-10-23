"use client";

import { MonoLabel } from "@/components/stride/mono-label";
import { syncLabel } from "@/features/app-shell/shell";
import { useDataActivity } from "./provider";

function useGarminSyncLabel() {
  const activity = useDataActivity();
  return syncLabel(activity?.observation?.sync.lastSyncAt ?? null, new Date());
}

export function GarminSyncSuffix() {
  const label = useGarminSyncLabel();
  return label ? ` · ${label.toLowerCase()}` : null;
}

export function GarminSyncLabel() {
  const label = useGarminSyncLabel();
  return label && <MonoLabel size="nano">{label}</MonoLabel>;
}
