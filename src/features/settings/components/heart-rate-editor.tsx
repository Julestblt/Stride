"use client";

import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CoachNote } from "@/components/stride/coach-note";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  heartRateOverrideSchema,
  thresholdSources,
  type ThresholdSource,
} from "../profile";

export function HeartRateEditor({
  kind,
  value,
  source,
  zones,
  onApply,
  onCancel,
  onRevert,
}: {
  kind: "maximum" | "threshold";
  zones: HeartRateZones | null;
  value: number | null;
  source: ThresholdSource | null;
  onApply: (value: number, source: ThresholdSource | null) => void;
  onCancel: () => void;
  onRevert: () => void;
}) {
  const [input, setInput] = useState(value === null ? "" : String(value));
  const [origin, setOrigin] = useState<ThresholdSource>(source ?? "known");
  const parsed = heartRateOverrideSchema.safeParse(
    /^\d+$/.test(input) ? Number(input) : NaN,
  );
  const label = kind === "maximum" ? "FC max" : "FC au seuil";
  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <FieldGroup className="gap-4">
        <Field
          className="min-[1100px]:grid min-[1100px]:grid-cols-[180px_320px_minmax(0,1fr)] min-[1100px]:items-center min-[1100px]:gap-5"
          data-invalid={!parsed.success}
        >
          <FieldLabel htmlFor={`edit-${kind}`} className="max-[1100px]:sr-only">
            {label}
          </FieldLabel>
          <div className="flex items-center gap-2">
            {kind === "threshold" && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Diminuer"
                className="size-13 text-xl min-[1100px]:order-2 min-[1100px]:size-10 min-[1100px]:text-body"
                onClick={() =>
                  setInput(String(Math.max(100, (Number(input) || 100) - 1)))
                }
              >
                −
              </Button>
            )}
            <InputGroup className="h-13 flex-1 has-[[data-slot=input-group-control]:focus-visible]:border-foreground has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/12 max-[1100px]:justify-center max-[1100px]:gap-1.5 min-[1100px]:h-10!">
              <InputGroupInput
                autoFocus
                id={`edit-${kind}`}
                className="text-right font-metric text-[34px] font-semibold max-[1100px]:w-[76px]! max-[1100px]:flex-none! max-[1100px]:px-0! min-[1100px]:h-10! min-[1100px]:text-left min-[1100px]:font-sans min-[1100px]:text-body min-[1100px]:font-normal"
                aria-label={`${label} en bpm`}
                inputMode="numeric"
                type="text"
                min={100}
                max={230}
                step={1}
                value={input}
                aria-invalid={!parsed.success}
                onChange={(event) => setInput(event.target.value)}
              />
              <InputGroupAddon align="inline-end" className="max-[1100px]:p-0!">
                bpm
              </InputGroupAddon>
            </InputGroup>
            {kind === "threshold" && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Augmenter"
                className="size-13 text-xl min-[1100px]:order-3 min-[1100px]:size-10 min-[1100px]:text-body"
                onClick={() =>
                  setInput(String(Math.min(230, (Number(input) || 100) + 1)))
                }
              >
                +
              </Button>
            )}
          </div>
          <span className="hidden text-xs text-muted-foreground min-[1100px]:block">
            Ta valeur · conservée après les imports
          </span>
        </Field>
        {!parsed.success && (
          <p role="status" className="text-xs text-danger min-[1100px]:pl-50">
            Saisis un nombre entier de 100 à 230 bpm.
          </p>
        )}
        {kind === "threshold" && (
          <>
            <Field className="min-[1100px]:grid min-[1100px]:grid-cols-[180px_minmax(0,1fr)] min-[1100px]:items-start min-[1100px]:gap-5">
              <FieldLabel className="text-muted-foreground min-[1100px]:pt-2">
                D’où vient-elle ?
              </FieldLabel>
              <div className="flex flex-col gap-2">
                <ToggleGroup
                  type="single"
                  value={origin}
                  onValueChange={(next) => {
                    const option = thresholdSources.find(
                      (item) => item.value === next,
                    );
                    if (option) setOrigin(option.value);
                  }}
                  aria-label="Source du seuil"
                  className="grid grid-cols-2 gap-1.5 min-[1100px]:flex"
                >
                  {thresholdSources.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="px-3 text-meta last:col-span-2 min-[1100px]:flex-none min-[1100px]:text-sm"
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="hidden text-xs text-muted-foreground min-[1100px]:block">
                  La source reste associée à ta valeur lors des futurs imports.
                </p>
              </div>
            </Field>
            <div className="flex flex-col gap-3 min-[1100px]:grid min-[1100px]:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] min-[1100px]:gap-5">
              <span className="font-mono text-nano tracking-wider text-muted-foreground uppercase min-[1100px]:pt-2 min-[1100px]:font-sans min-[1100px]:text-xs min-[1100px]:tracking-normal min-[1100px]:normal-case">
                Ce que ça change
              </span>
              <div className="flex flex-col gap-2">
                <MonoLabel size="micro">Zones actuelles · inchangées</MonoLabel>
                {[3, 4, 5].map((number) => {
                  const zone = zones?.zones.find(
                    (item) => item.zone === number,
                  );
                  return (
                    <div
                      key={number}
                      className="grid grid-cols-[34px_1fr_auto] items-baseline gap-2 border-t border-border py-1.75 text-xs"
                    >
                      <MonoLabel size="nano">Z{number}</MonoLabel>
                      <span className="font-metric text-lead">
                        {zone
                          ? `${zone.lower}–${zone.upper} bpm`
                          : "Indisponible"}
                      </span>
                      <span className="text-muted-foreground">
                        Sans changement
                      </span>
                    </div>
                  );
                })}
              </div>
              <CoachNote className="text-meta">
                {zones?.method === "karvonen"
                  ? "Les zones utilisent ta FC max et ta FC au repos."
                  : zones?.method === "percentage_maximum"
                    ? "Les zones utilisent des pourcentages de ta FC max, sans FC au repos."
                    : "Les zones sont indisponibles faute de données suffisantes."}{" "}
                Ta valeur sera enregistrée avec sa source. Aucune séance n’est
                ajustée automatiquement.
              </CoachNote>
            </div>
          </>
        )}
      </FieldGroup>
      <div className="flex flex-col gap-2 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:gap-2 min-[1100px]:pl-50">
        <Button
          type="button"
          variant="neutral"
          disabled={!parsed.success}
          onClick={() => {
            if (parsed.success)
              onApply(parsed.data, kind === "threshold" ? origin : null);
          }}
        >
          Appliquer
        </Button>
        <div className="flex gap-2 min-[1100px]:contents">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-[1100px]:flex-none"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 flex-[1.4] whitespace-normal min-[1100px]:ml-auto min-[1100px]:flex-none"
            onClick={onRevert}
          >
            Revenir aux données {kind === "maximum" ? "de course" : "Garmin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
