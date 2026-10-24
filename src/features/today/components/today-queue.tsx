"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { SessionKindTile } from "@/components/stride/session-kind-tile";
import { FeelingPrompt } from "@/features/activities/components/feeling-prompt";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { PairQuestionCard } from "@/features/gear/components/activity-pair";
import { cn } from "@/lib/utils";
import { queueNext, queueOrder } from "../queue";
import type { TodayActivity, TodayQueueItem } from "../today";
import { LegsCheckin } from "./legs-checkin";

function ActivityRow({ activity }: { activity: TodayActivity }) {
  return (
    <Link
      href={activity.href}
      className="flex items-center gap-3 rounded-surface border border-border px-3 py-2.5 hover:bg-surface-raised"
    >
      <SessionKindTile kind={activity.family} size="lg" className="size-8" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">
          {activity.heading} · {activity.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {activity.detail}
        </span>
      </span>
      {activity.compliance && (
        <span
          className={cn(
            "flex items-center gap-1.25 text-xs whitespace-nowrap",
            activity.compliance.partial ? "text-warning" : "text-success",
          )}
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
          {activity.compliance.partial ? "En partie" : "Réussie"}
          {activity.compliance.pct !== null &&
            ` · ${activity.compliance.pct} %`}
        </span>
      )}
    </Link>
  );
}

function QueueItem({ item }: { item: TodayQueueItem }) {
  if (item.kind === "feeling")
    return (
      <>
        <ActivityRow activity={item.activity} />
        <FeelingPrompt activityId={item.activityId} compact />
      </>
    );
  if (item.kind === "pair")
    return (
      <>
        {item.activity && <ActivityRow activity={item.activity} />}
        <PairQuestionCard question={item.question} />
      </>
    );
  return <LegsCheckin initial={null} hint={item.hint} />;
}

export function TodayQueue({ items }: { items: TodayQueueItem[] }) {
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  if (items.length === 0) return null;
  const [current, ...rest] = queueOrder(items, currentKey);
  const position = items.indexOf(current) + 1;
  const next = queueNext(rest.map((item) => item.label));
  return (
    <section
      aria-labelledby="today-queue"
      className="flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-5 sm:px-5.5"
    >
      <div className="flex items-center gap-2.5">
        <h2>
          <MonoLabel
            id="today-queue"
            size="nano"
            tone="foreground"
            className="text-[9.5px]"
          >
            À faire
          </MonoLabel>
        </h2>
        <span aria-hidden="true" className="flex items-center gap-1">
          {items.map((item) => (
            <span
              key={item.key}
              className={cn(
                "size-1.5 rounded-full",
                item === current ? "bg-accent" : "bg-border-strong",
              )}
            />
          ))}
        </span>
        <MonoLabel size="micro" aria-live="polite" className="ml-auto">
          {position} sur {items.length}
        </MonoLabel>
      </div>
      <QueueItem key={current.key} item={current} />
      {next && (
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="flex-1">{next}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-sm:h-11"
            onClick={() => setCurrentKey(rest[0].key)}
          >
            Plus tard
          </Button>
        </div>
      )}
    </section>
  );
}
