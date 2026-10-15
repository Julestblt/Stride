"use client";

import { useRef, useState } from "react";
import { clockLabel } from "@/features/garmin/settings-view";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncRequest } from "./sync-request";

const threshold = 64;
const visibleFrom = 12;

function scrolledAbove(target: EventTarget | null, root: Element) {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== root;
    node = node.parentElement
  )
    if (node.scrollTop > 0) return true;
  return false;
}

export function PullToSync({ children }: { children: React.ReactNode }) {
  const sync = useSyncRequest();
  const isMobile = useIsMobile();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [distance, setDistance] = useState(0);
  const enabled =
    isMobile &&
    sync !== null &&
    sync.state !== "offline" &&
    sync.state !== "reconnect";

  const reset = () => {
    origin.current = null;
    setDistance(0);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (
      !enabled ||
      event.touches.length !== 1 ||
      !event.currentTarget.contains(event.target as Node) ||
      scrolledAbove(event.target, event.currentTarget)
    )
      return;
    origin.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = origin.current;
    if (!start) return;
    const dy = event.touches[0].clientY - start.y;
    const dx = Math.abs(event.touches[0].clientX - start.x);
    if (dy <= 0 || dx > dy) return reset();
    setDistance(Math.min(dy, threshold * 1.5));
  };

  const onTouchEnd = () => {
    if (distance >= threshold && sync && !sync.disabled) sync.request();
    reset();
  };

  const ready = distance >= threshold;
  const availableAt =
    sync?.availableAt != null
      ? clockLabel(new Date(sync.availableAt).toISOString())
      : null;
  const label = sync?.running
    ? "Synchronisation en cours…"
    : availableAt
      ? `Synchronisation possible à ${availableAt}`
      : ready
        ? "Relâche pour synchroniser Garmin"
        : "Tire pour synchroniser Garmin";
  const share = Math.min(1, distance / threshold);

  return (
    <div
      className="contents"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={reset}
    >
      {distance >= visibleFrom && (
        <div
          data-testid="pull-to-sync"
          role="status"
          className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center md:hidden"
          style={{ transform: `translateY(${Math.round(share * 12)}px)` }}
        >
          <span className="flex items-center gap-2.5 rounded-full border border-border-strong bg-surface-raised py-1.5 pr-3.5 pl-2 text-xs text-muted-foreground">
            <svg
              viewBox="0 0 22 22"
              aria-hidden="true"
              className="size-5.5 shrink-0 fill-none"
            >
              <circle
                cx="11"
                cy="11"
                r="9"
                strokeWidth="2"
                className="stroke-border"
              />
              <circle
                cx="11"
                cy="11"
                r="9"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${share * 100} 100`}
                transform="rotate(-90 11 11)"
                className="stroke-provider"
              />
            </svg>
            {label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
