"use client";

import { useLayoutEffect, useRef } from "react";

function readPosition(key: string) {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function writePosition(key: string, position: number) {
  try {
    sessionStorage.setItem(key, String(position));
  } catch {}
}

export function ListScrollRegion({
  storageKey,
  label,
  className,
  children,
}: {
  storageKey: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const region = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = region.current;
    if (!element) return;
    const saved = readPosition(storageKey);
    if (saved !== null && Number.isFinite(saved)) element.scrollTop = saved;
    else
      element
        .querySelector('[aria-current="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [storageKey]);

  return (
    <div
      ref={region}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={className}
      onScroll={(event) =>
        writePosition(storageKey, event.currentTarget.scrollTop)
      }
    >
      {children}
    </div>
  );
}
