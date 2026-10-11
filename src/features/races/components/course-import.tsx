"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRightIcon,
  CheckIcon,
  FileTextIcon,
  HistoryIcon,
  UploadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatInteger, formatKm } from "../format";
import { actionMessage, importMessage } from "../messages";
import {
  formatShortDate,
  type CourseActivity,
  type RaceSummary,
} from "../race";
import { importCourseFromActivity } from "@/server/races/actions";
import { CardLabel, RaceCard } from "./race-ui";

const benefits = [
  ["La carte et le profil altimétrique", "Carte et profil"],
  [
    "Les points de passage du GPX, ou ceux que tu ajoutes",
    "Points de passage, détectés ou ajoutés",
  ],
  [
    "Les portions à marcher, selon la pente que tu choisis",
    "Portions à marcher selon ta pente",
  ],
  [
    "Les passages de nuit, calculés avec ton heure de départ",
    "Passages de nuit",
  ],
  [
    "La météo heure par heure, placée le long du parcours",
    "Météo le long du parcours",
  ],
  [
    "Une course .fit avec alertes à charger sur ta montre",
    "Course .fit avec alertes pour ta montre",
  ],
] as const;

export async function uploadTo(url: string, body: FormData) {
  const response = await fetch(url, { method: "POST", body });
  const result = (await response.json().catch(() => ({ status: "error" }))) as {
    status: string;
  };
  return result;
}

export function CourseImport({
  race,
  activities,
  replacing,
}: {
  race: RaceSummary;
  activities: CourseActivity[];
  replacing: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"link" | "activity" | null>(null);
  const [pending, startTransition] = useTransition();
  const base = `/races/${race.id}`;

  function done() {
    setError(null);
    setDialog(null);
    router.push(base);
    router.refresh();
  }

  function sendFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024)
      return setError(importMessage("too-large"));
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const result = await uploadTo(`/api/races/${race.id}/course`, body);
      if (result.status === "saved") done();
      else setError(importMessage(result.status));
    });
  }

  function sendRoadbook(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const result = await uploadTo(`/api/races/${race.id}/roadbook`, body);
      if (result.status === "roadbook-saved") {
        setError(null);
        router.push(`${base}/waypoints`);
        router.refresh();
      } else setError(importMessage(result.status));
    });
  }

  function sendLink(form: FormData) {
    const body = new FormData();
    body.set("link", String(form.get("link") ?? ""));
    body.set("intent", "course");
    startTransition(async () => {
      const result = await uploadTo(`/api/races/${race.id}/roadbook`, body);
      if (result.status === "course-saved") done();
      else if (result.status === "roadbook-saved") {
        setDialog(null);
        router.push(`${base}/waypoints`);
        router.refresh();
      } else setError(importMessage(result.status));
    });
  }

  function pickActivity(id: string) {
    startTransition(async () => {
      const result = await importCourseFromActivity(race.id, id);
      if (result.status === "saved") done();
      else setError(actionMessage(result.status));
    });
  }

  const others = [
    {
      key: "link",
      icon: <ArrowUpRightIcon className="size-3.5" />,
      title: "Coller un lien",
      detail: "Site de la course, page Tracedetrail ou UTMB World.",
      disabled: false,
    },
    {
      key: "activity",
      icon: <HistoryIcon className="size-3.5" />,
      title: "Depuis une activité Garmin",
      detail:
        "Si tu as déjà couru tout ou partie du parcours, Stride reprend ton tracé.",
      disabled: activities.length === 0,
    },
    {
      key: "roadbook",
      icon: <FileTextIcon className="size-3.5" />,
      title: "Avec le roadbook PDF",
      detail: replacing
        ? "Stride lit la liste des ravitos, barrières et services, et les place sur le tracé."
        : "Disponible une fois le GPX ajouté : Stride place alors les ravitos, barrières et services sur le tracé.",
      disabled: !replacing,
    },
  ];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <RaceCard className="gap-0 overflow-hidden p-0 sm:p-0">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            sendFile(event.dataTransfer.files[0]);
          }}
          className={cn(
            "m-5 flex flex-col items-center gap-3.5 rounded-panel border-[1.5px] border-dashed border-dim bg-surface-inset px-6 py-8 text-center transition-colors sm:m-6 sm:py-12",
            dragging && "border-accent bg-surface-raised",
          )}
          aria-busy={pending}
        >
          <span className="grid size-13 place-items-center rounded-panel border border-border-strong bg-surface-raised text-accent">
            <UploadIcon className="size-4.5" />
          </span>
          <h2 className="text-title font-semibold tracking-[-0.02em]">
            {replacing
              ? "Remplace le GPX de la course"
              : "Ajoute le GPX de la course"}
          </h2>
          <p className="max-w-105 text-sm leading-[1.55] text-muted">
            <span className="max-sm:hidden">
              Glisse ici le fichier .gpx fourni par l’organisation. Un seul
              fichier, 20 Mo maximum.
            </span>
            <span className="sm:hidden">
              Le fichier .gpx fourni par l’organisation, depuis tes fichiers ou
              un lien.
            </span>
          </p>
          <input
            ref={input}
            type="file"
            accept=".gpx,application/gpx+xml,application/xml,text/xml"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => sendFile(event.target.files?.[0])}
          />
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => sendRoadbook(event.target.files?.[0])}
          />
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Button
              type="button"
              size="md"
              className="min-h-10.5 rounded-surface"
              onClick={() => input.current?.click()}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? "Import en cours…" : "Choisir un fichier"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              className="min-h-10.5 rounded-surface sm:hidden"
              onClick={() => setDialog("link")}
            >
              Coller un lien
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          )}
        </div>
        <div className="px-6 pb-5 max-sm:hidden">
          <MonoLabel>Autres façons de l’ajouter</MonoLabel>
          {others.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                if (option.key === "roadbook") pdfInput.current?.click();
                else setDialog(option.key === "link" ? "link" : "activity");
              }}
              disabled={option.disabled || pending}
              className="flex w-full items-start gap-3 border-t border-border py-3 text-left transition-colors first-of-type:mt-2 focus-visible:outline-2 focus-visible:outline-ring enabled:hover:bg-surface-raised/40 disabled:opacity-50"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-control border border-border-strong text-muted">
                {option.icon}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{option.title}</span>
                <span className="text-meta leading-[1.45] text-muted-foreground">
                  {option.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </RaceCard>
      <div className="flex flex-col gap-5">
        <RaceCard>
          <CardLabel>Ce que Stride en tire</CardLabel>
          <ul>
            {benefits.map(([long, short]) => (
              <li
                key={long}
                className="flex gap-2.5 py-2 text-sm text-muted max-sm:border-t max-sm:border-border"
              >
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span className="max-sm:hidden">{long}</span>
                <span className="sm:hidden">{short}</span>
              </li>
            ))}
          </ul>
        </RaceCard>
        {!replacing && (
          <RaceCard>
            <CardLabel coach>En attendant</CardLabel>
            <p className="text-sm leading-[1.55] text-muted">
              Sans GPX, Stride ne connaît que{" "}
              {race.distanceKm
                ? `les ${formatInteger(race.distanceKm)} km`
                : "la distance"}
              {race.elevationGainM !== null
                ? ` et les ${formatInteger(race.elevationGainM)} m de D+`
                : ""}{" "}
              annoncés : pas encore de passages par ravito, ni de nuit ou de
              météo le long du parcours.
            </p>
          </RaceCard>
        )}
      </div>
      <Dialog
        open={dialog === "link"}
        onOpenChange={(open) => setDialog(open ? "link" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coller un lien</DialogTitle>
            <DialogDescription>
              Lien direct vers un fichier .gpx, ou page de la course qui en
              propose un. Stride récupère le tracé et, s’il le trouve, le
              roadbook.
            </DialogDescription>
          </DialogHeader>
          <form action={sendLink} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="course-link">Adresse</FieldLabel>
              <Input
                id="course-link"
                name="link"
                type="url"
                inputMode="url"
                required
                placeholder="https://"
              />
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
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? "Récupération…" : "Importer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "activity"}
        onOpenChange={(open) => setDialog(open ? "activity" : null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Depuis une activité Garmin</DialogTitle>
            <DialogDescription>
              Le tracé GPS de l’activité devient le parcours de la course.
            </DialogDescription>
          </DialogHeader>
          <ul className="-mx-1 flex max-h-96 flex-col overflow-y-auto">
            {activities.map((activity) => (
              <li key={activity.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pickActivity(activity.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-control px-2 py-2.5 text-left hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{activity.title}</span>
                    <MonoLabel size="nano">
                      {formatShortDate(activity.date)}
                    </MonoLabel>
                  </span>
                  <span className="shrink-0 font-metric text-base">
                    {activity.distanceM
                      ? `${formatKm(activity.distanceM)} km`
                      : ""}
                    {activity.elevationGainM
                      ? ` · +${formatInteger(activity.elevationGainM)} m`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
