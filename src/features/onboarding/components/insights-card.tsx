"use client";
import { useEffect, useId, useState } from "react";
import { StrideMark } from "@/components/stride/stride-mark";
import {
  insightsResponseSchema,
  type InsightsResponse,
} from "@/features/insights/schemas";
import { cn } from "@/lib/utils";

export function useImportInsights(
  refreshKey: string,
  fallback?: InsightsResponse,
) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 25_000);
    fetch("/api/onboarding/insights", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        const parsed = insightsResponseSchema.safeParse(body);
        if (active)
          setInsights(
            parsed.success
              ? parsed.data
              : (fallback ?? { items: [], final: true }),
          );
      })
      .catch(() => {
        if (active) setInsights(fallback ?? { items: [], final: true });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [refreshKey, fallback]);
  return insights;
}

export function InsightsCard({
  insights,
  className,
  title = "Ce que je remarque",
  footer = "Tu confirmeras ou corrigeras tout ça à la fin.",
  unavailable,
}: {
  insights: InsightsResponse | null;
  className?: string;
  title?: string;
  footer?: string;
  unavailable?: string;
}) {
  const headingId = useId();
  const items = insights?.items ?? [];
  const pending = !insights?.final;
  if (!pending && items.length === 0 && !unavailable) return null;
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={insights === null}
      className={cn(
        "flex flex-col gap-5 rounded-card border border-border bg-surface p-5 lg:p-6",
        className,
      )}
    >
      <h2
        id={headingId}
        className="flex items-center gap-3 text-body font-semibold"
      >
        <StrideMark className="size-4" />
        {title}
      </h2>
      {!pending && items.length === 0 && (
        <p className="text-body text-muted">{unavailable}</p>
      )}
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="grid grid-cols-[0.375rem_1fr] gap-x-4 border-b border-border py-4 first:pt-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-2 size-1.5 rounded-full",
                index === 0 ? "bg-accent" : "bg-foreground",
              )}
            />
            <span className="flex flex-col gap-1.5">
              <span className="text-body text-pretty">{item.text}</span>
              <span className="font-mono text-micro text-muted-foreground uppercase">
                {item.source}
              </span>
            </span>
          </li>
        ))}
        {pending && (
          <li className="grid grid-cols-[0.375rem_1fr] gap-x-4 py-4 first:pt-0">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 rounded-full bg-muted-foreground motion-safe:animate-breathe"
            />
            <span className="flex flex-col gap-1.5">
              <span className="text-body text-muted-foreground">
                J’analyse encore ton historique…
              </span>
              <span className="font-mono text-micro text-muted-foreground uppercase">
                Habitudes d’entraînement
              </span>
            </span>
          </li>
        )}
      </ul>
      <div className="flex flex-col gap-1.5">
        <p className="text-meta text-muted-foreground">{footer}</p>
        {items.some((item) => item.origin === "ai") && (
          <p className="font-mono text-nano text-muted-foreground uppercase">
            Formulé par IA à partir de tes données
          </p>
        )}
      </div>
    </section>
  );
}
