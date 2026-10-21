"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  formatClock,
  formatDuration,
  parseClock,
  parseHoursMinutes,
} from "../format";
import { actionMessage } from "../messages";
import type { RacePlan } from "../race";
import type { RaceKind } from "@/features/onboarding/goals";
import { saveRacePlan, saveRaceTarget } from "@/server/races/actions";

function durationText(seconds: number | null) {
  return seconds ? formatDuration(seconds) : "";
}

export function RaceSettingsDialog({
  raceId,
  raceRevision,
  targetSeconds,
  kind,
  plan,
  children,
}: {
  raceId: string;
  raceRevision: number;
  targetSeconds: number | null;
  kind: RaceKind;
  plan: RacePlan;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const optionalDuration = (name: string) =>
      text(name) ? parseHoursMinutes(text(name)) : null;
    const start = text("start") ? parseClock(text("start")) : null;
    const target = optionalDuration("target");
    const raceKind = text("race-kind") as RaceKind;
    const ambitious = optionalDuration("ambitious");
    const cautious = optionalDuration("cautious");
    const cutoff = optionalDuration("cutoff");
    const invalid = [
      ["start", start],
      ["target", target],
      ["ambitious", ambitious],
      ["cautious", cautious],
      ["cutoff", cutoff],
    ].some(([name, value]) => text(String(name)) !== "" && value === null);
    if (invalid) {
      setError(
        "Utilise le format 06:00 pour l’heure et 18h30 pour les durées.",
      );
      return;
    }
    setError(null);
    const labels = text("labels")
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .slice(0, 4);
    startTransition(async () => {
      const saved = await saveRacePlan(raceId, plan.revision, {
        startMinutes: start,
        startConfirmed: form.get("confirmed") === "on",
        ambitiousSeconds: ambitious,
        cautiousSeconds: cautious,
        cutoffSeconds: cutoff,
        labels,
      });
      if (saved.status !== "saved") {
        toast.error(actionMessage(saved.status));
        return;
      }
      if (target !== targetSeconds || raceKind !== kind) {
        const result = await saveRaceTarget(
          raceId,
          raceRevision,
          target,
          raceKind,
        );
        if (result.status !== "saved") {
          toast.error(actionMessage(result.status));
          return;
        }
      }
      toast.success("Réglages de la course enregistrés.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la course</DialogTitle>
          <DialogDescription>
            Ces réglages adaptent la préparation de ta course.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="race-kind">Type de course</FieldLabel>
            <select
              id="race-kind"
              name="race-kind"
              defaultValue={kind}
              className="h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="road">Route</option>
              <option value="trail">Trail</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="race-start">Heure de départ</FieldLabel>
              <Input
                id="race-start"
                name="start"
                inputMode="numeric"
                placeholder="06:00"
                defaultValue={
                  plan.startMinutes === null
                    ? ""
                    : formatClock(plan.startMinutes)
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="race-cutoff">Barrière d’arrivée</FieldLabel>
              <Input
                id="race-cutoff"
                name="cutoff"
                placeholder="21h15"
                defaultValue={durationText(plan.cutoffSeconds)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="confirmed" defaultChecked={plan.startConfirmed} />
            Heure de départ confirmée par l’organisation
          </label>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="race-ambitious">Ambitieux</FieldLabel>
              <Input
                id="race-ambitious"
                name="ambitious"
                placeholder={
                  targetSeconds
                    ? formatDuration(
                        Math.round((targetSeconds * 0.9) / 60) * 60,
                      )
                    : "Facultatif"
                }
                defaultValue={durationText(plan.ambitiousSeconds)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="race-target">Objectif</FieldLabel>
              <Input
                id="race-target"
                name="target"
                placeholder="Temps visé"
                defaultValue={durationText(targetSeconds)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="race-cautious">Prudent</FieldLabel>
              <Input
                id="race-cautious"
                name="cautious"
                placeholder={
                  targetSeconds
                    ? formatDuration(
                        Math.round((targetSeconds * 1.1) / 60) * 60,
                      )
                    : "Facultatif"
                }
                defaultValue={durationText(plan.cautiousSeconds)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="race-labels">Mentions</FieldLabel>
            <Input
              id="race-labels"
              name="labels"
              placeholder="qualificative UTMB 100K, bâtons interdits"
              defaultValue={plan.labels.join(", ")}
            />
            <FieldDescription>
              Jusqu’à 4 mentions, séparées par des virgules.
            </FieldDescription>
          </Field>
          {error && (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              size="md"
              aria-busy={pending}
              disabled={pending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
