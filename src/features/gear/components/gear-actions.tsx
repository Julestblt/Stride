"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  setCurrentKm,
  setShoeRetired,
  type GearActionResult,
} from "@/server/gear/actions";
import { gearErrorMessage, parseKm } from "../form";

export function RetireShoeButton({
  id,
  retired,
}: {
  id: string;
  retired: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await setShoeRetired({ id, retired: !retired });
      if (result.status === "saved") {
        setOpen(false);
        toast.success(retired ? "Paire remise en service." : "Paire retirée.");
      } else toast.error(gearErrorMessage(result));
    });
  if (retired)
    return (
      <Button variant="outline" size="md" disabled={pending} onClick={run}>
        Remettre en service
      </Button>
    );
  return (
    <>
      <Button variant="destructive" size="md" onClick={() => setOpen(true)}>
        Retirer
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Retirer cette paire ?</AlertDialogTitle>
          <AlertDialogDescription>
            Elle passe dans les paires retirées, ici et dans Garmin Connect. Ses
            kilomètres et son historique sont conservés.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                run();
              }}
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CurrentKmButton({
  id,
  currentKm,
  garminKm,
}: {
  id: string;
  currentKm: number;
  garminKm: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(Math.round(currentKm)));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const km = parseKm(value);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (km === null || km < garminKm) {
      setMessage(
        `Saisis un total d’au moins ${Math.ceil(garminKm)} km, ce que Garmin a déjà compté.`,
      );
      return;
    }
    startTransition(async () => {
      const result: GearActionResult = await setCurrentKm({
        id,
        currentKm: km,
      });
      if (result.status === "saved") {
        setOpen(false);
        toast.success("Kilométrage mis à jour.");
      } else toast.error(gearErrorMessage(result));
    });
  };
  return (
    <>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        Ajuster les km actuels
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogTitle>Kilomètres actuels</DialogTitle>
            <DialogDescription>
              Garmin a compté {Math.round(garminKm)} km. Stride garde la
              différence comme km de départ et règle l’alerte d’usure dans
              Garmin.
            </DialogDescription>
            <Field>
              <FieldLabel htmlFor="current-km">Total de la paire</FieldLabel>
              <Input
                id="current-km"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setMessage("");
                }}
              />
              <FieldDescription>
                En kilomètres, par exemple le total Strava.
              </FieldDescription>
            </Field>
            {message && (
              <p role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="md" disabled={pending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
