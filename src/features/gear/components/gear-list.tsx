import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { SourceMark } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import type { PairCardView, PairListView } from "../view";
import { WearGauge } from "./wear-gauge";

function PairCard({ pair }: { pair: PairCardView }) {
  return (
    <Link
      href={`/gear/${pair.id}`}
      className="flex min-w-0 flex-col gap-4 rounded-panel border border-border bg-surface p-5 text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MonoLabel
          size="nano"
          tone="secondary"
          className="rounded-tag border border-border-strong px-1.5 py-0.5"
        >
          {pair.category}
        </MonoLabel>
        {!pair.garminLinked && (
          <span className="text-xs text-muted-foreground">Hors Garmin</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-meta text-muted-foreground">{pair.brand}</span>
        <h2 className="text-lead font-semibold tracking-[-0.015em]">
          {pair.model}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-metric text-[40px] leading-[0.9] font-semibold tabular-nums">
            {pair.totalKm}
          </span>
          <span className="text-meta text-muted-foreground">
            / {pair.lifespanKm} km
          </span>
          <span
            className={cn(
              "ml-auto font-metric text-lg font-semibold tabular-nums",
              pair.high ? "text-warning" : "text-muted-foreground",
            )}
          >
            {pair.percent}
          </span>
        </div>
        <WearGauge wear={pair.wear} />
        <span
          className={cn(
            "text-xs",
            pair.high ? "text-warning" : "text-muted-foreground",
          )}
        >
          {pair.remaining}
        </span>
      </div>
      {(pair.specs || pair.lastRun) && (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {pair.specs && <span>{pair.specs}</span>}
          {pair.lastRun && <span>Dernière sortie : {pair.lastRun}</span>}
        </div>
      )}
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4.5 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <SourceMark source="provider" />
        km comptés par Garmin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <SourceMark source="manual" />
        km de départ saisis par toi
      </span>
    </div>
  );
}

export function GearList({
  view,
  importable,
  alerts = null,
  children,
}: {
  view: PairListView;
  importable: number;
  alerts?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const empty = view.active.length === 0 && view.retired.length === 0;
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(32px,3.5vw,44px)] leading-none font-semibold tracking-[-0.03em]">
            Matériel
          </h1>
          <p className="text-sm text-muted">
            {empty
              ? "Ajoute tes chaussures : Garmin comptera leurs kilomètres."
              : `${view.active.length > 1 ? `${view.active.length} paires actives` : `${view.active.length} paire active`} · ${view.totalKm} km cumulés · les kilomètres viennent de Garmin`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {importable > 0 && (
            <Button asChild variant="outline" size="md">
              <Link href="/gear/import">Importer depuis Garmin</Link>
            </Button>
          )}
          <Button asChild size="md">
            <Link href="/gear/new">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Ajouter une paire
            </Link>
          </Button>
        </div>
      </section>

      {alerts}

      {empty ? (
        <section className="flex flex-col items-start gap-3 rounded-panel border border-border bg-surface p-6">
          <h2 className="text-lead font-semibold">
            Aucune paire pour l’instant
          </h2>
          <p className="max-w-150 text-sm leading-normal text-muted">
            Stride crée chaque paire dans Garmin Connect. Garmin compte ensuite
            chaque sortie et te prévient quand la paire est usée.
          </p>
        </section>
      ) : (
        <section
          aria-label="Paires actives"
          className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-3.5"
        >
          {view.active.map((pair) => (
            <PairCard key={pair.id} pair={pair} />
          ))}
        </section>
      )}

      {children}

      {view.retired.length > 0 && (
        <details className="group border-t border-border pt-3.5">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm text-muted [&::-webkit-details-marker]:hidden">
            Paires retirées · {view.retired.length}
          </summary>
          <ul className="mt-2">
            {view.retired.map((pair) => (
              <li key={pair.id} className="border-t border-border">
                <Link
                  href={`/gear/${pair.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_90px_120px] gap-3 py-2.5 text-meta text-muted hover:text-foreground"
                >
                  <span className="truncate">{pair.name}</span>
                  <span className="text-right font-metric text-base text-foreground tabular-nums">
                    {pair.km}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {pair.retiredOn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!empty && <Legend />}
    </>
  );
}
