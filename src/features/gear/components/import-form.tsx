"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MonoLabel } from "@/components/stride/mono-label";
import { SourceMark } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import { importShoes } from "@/server/gear/actions";
import { gearErrorMessage, parseKm } from "../form";
import {
  categoryLabels,
  defaultLifespanKm,
  defaultTerrain,
  shoeCategories,
  type ShoeCategory,
} from "../model";

export type ImportableGear = {
  gearUuid: string;
  brand: string;
  model: string;
  name: string;
  garminKm: number;
  retired: boolean;
};

type Row = {
  selected: boolean;
  currentKm: string;
  category: ShoeCategory;
};

const kmFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function ImportForm({ gear }: { gear: ImportableGear[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      gear.map((item) => [
        item.gearUuid,
        {
          selected: !item.retired,
          currentKm: String(Math.round(item.garminKm)),
          category: /trail|speedgoat|zegama|glide/i.test(item.name)
            ? "trail"
            : "daily",
        },
      ]),
    ),
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const update = (uuid: string, change: Partial<Row>) =>
    setRows((current) => ({
      ...current,
      [uuid]: { ...current[uuid], ...change },
    }));
  const selected = gear.filter((item) => rows[item.gearUuid]?.selected);
  const invalid = selected.filter((item) => {
    const km = parseKm(rows[item.gearUuid].currentKm);
    return km === null || km < Math.floor(item.garminKm);
  });

  const submit = () => {
    if (invalid.length) {
      setMessage(
        "Un total ne peut pas être inférieur à ce que Garmin a déjà compté.",
      );
      return;
    }
    startTransition(async () => {
      const result = await importShoes(
        selected.map((item) => {
          const row = rows[item.gearUuid];
          return {
            garminGearUuid: item.gearUuid,
            brand: item.brand,
            model: item.model,
            category: row.category,
            terrain: defaultTerrain[row.category],
            lifespanKm: defaultLifespanKm[row.category],
            currentKm: parseKm(row.currentKm) ?? item.garminKm,
          };
        }),
      );
      if (result.status === "saved") router.push("/gear");
      else setMessage(gearErrorMessage(result));
    });
  };

  if (gear.length === 0)
    return (
      <section className="flex flex-col items-start gap-3 rounded-panel border border-border bg-surface p-6">
        <h2 className="text-lead font-semibold">Aucune paire à importer</h2>
        <p className="max-w-150 text-sm leading-normal text-muted">
          Ton compte Garmin n’a pas de chaussures qui ne soient pas déjà dans
          Stride. Ajoute tes paires dans Stride : elles seront créées dans
          Garmin.
        </p>
        <Button asChild size="md">
          <Link href="/gear/new">Ajouter une paire</Link>
        </Button>
      </section>
    );

  return (
    <>
      <section className="flex flex-col rounded-panel border border-border bg-surface p-5 sm:p-6">
        <div className="hidden grid-cols-[28px_minmax(0,1fr)_120px_170px] gap-3.5 pb-2.5 sm:grid">
          <span />
          <MonoLabel size="nano">Paire</MonoLabel>
          <MonoLabel size="nano" className="text-right">
            Compté par Garmin
          </MonoLabel>
          <MonoLabel size="nano" className="text-right">
            Km actuels
          </MonoLabel>
        </div>
        {gear.map((item) => {
          const row = rows[item.gearUuid];
          const km = parseKm(row.currentKm);
          const extra = km === null ? 0 : km - item.garminKm;
          const wrong =
            row.selected && (km === null || km < Math.floor(item.garminKm));
          return (
            <div
              key={item.gearUuid}
              className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3.5 border-t border-border py-3.5 sm:grid-cols-[28px_minmax(0,1fr)_120px_170px]"
            >
              <Checkbox
                id={`import-${item.gearUuid}`}
                checked={row.selected}
                onCheckedChange={(value) =>
                  update(item.gearUuid, { selected: value === true })
                }
              />
              <div className="flex min-w-0 flex-col gap-2">
                <label
                  htmlFor={`import-${item.gearUuid}`}
                  className="flex flex-col gap-0.5"
                >
                  <span className="truncate text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.retired
                      ? "retirée dans Garmin"
                      : "active dans Garmin"}
                  </span>
                </label>
                <select
                  aria-label={`Catégorie de ${item.name}`}
                  value={row.category}
                  onChange={(event) =>
                    update(item.gearUuid, {
                      category: event.target.value as ShoeCategory,
                    })
                  }
                  className="h-9 w-fit rounded-control border border-border-strong bg-surface-panel px-2.5 text-meta text-foreground"
                >
                  {shoeCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </select>
              </div>
              <span className="col-start-2 flex items-center gap-2 sm:col-start-auto sm:flex-col sm:items-end sm:gap-0.5">
                <span className="font-metric text-[19px] font-semibold tabular-nums">
                  {kmFormat.format(item.garminKm)} km
                </span>
                <MonoLabel
                  size="nano"
                  className="inline-flex items-center gap-1.5"
                >
                  <SourceMark source="provider" />
                  Garmin
                </MonoLabel>
              </span>
              <span className="col-start-2 flex flex-col gap-1 sm:col-start-auto">
                <span className="flex items-center gap-1.5">
                  <Input
                    aria-label={`Km actuels de ${item.name}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.currentKm}
                    aria-invalid={wrong || undefined}
                    className={cn(
                      "text-right font-metric text-lg font-semibold tabular-nums",
                      extra > 0.5 && "border-foreground",
                    )}
                    onChange={(event) =>
                      update(item.gearUuid, { currentKm: event.target.value })
                    }
                  />
                  <span className="text-meta text-muted-foreground">km</span>
                </span>
                <span
                  className={cn(
                    "text-right text-[11.5px]",
                    extra > 0.5 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {extra > 0.5
                    ? `+ ${kmFormat.format(extra)} km de départ`
                    : "identique à Garmin"}
                </span>
              </span>
            </div>
          );
        })}
      </section>
      <p className="text-meta leading-normal text-muted">
        Les anciennes activités restent sans paire : leurs kilomètres sont déjà
        dans le total que tu saisis. Tu pourras compléter la fiche de chaque
        paire ensuite.
      </p>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" size="md">
          <Link href="/gear">Annuler</Link>
        </Button>
        <Button
          size="md"
          disabled={pending || selected.length === 0}
          onClick={submit}
        >
          {selected.length > 1
            ? `Importer ${selected.length} paires`
            : "Importer la paire"}
        </Button>
      </div>
    </>
  );
}
