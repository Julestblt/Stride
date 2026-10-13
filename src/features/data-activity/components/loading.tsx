"use client";

import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataActivity } from "./provider";

export function DataActivityLoading({ label }: { label: string }) {
  const markLoading = useDataActivity()?.markLoading;
  useEffect(() => markLoading?.(), [markLoading]);
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col gap-6 p-5 sm:p-8"
    >
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
