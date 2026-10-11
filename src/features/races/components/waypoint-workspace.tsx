"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, PlusIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MonoLabel } from "@/components/stride/mono-label";
import { ProfileChart } from "./profile-chart";
import { CardLabel, RaceCard } from "./race-ui";
import { actionMessage, importMessage } from "../messages";
import {
  formatClock,
  formatKm,
  formatMargin,
  parseClock,
  parseKm,
} from "../format";
import type { ProfileData } from "../profile";
import {
  alertDistances,
  defaultWatchLabel,
  editableKinds,
  kindLabels,
  serviceLabels,
  services,
  type Waypoint,
  type WaypointInput,
  type WaypointMark,
} from "../waypoints";
import type { Passage } from "../simulation";
import { deleteWaypoint, saveWaypoint } from "@/server/races/actions";

function initialInput(
  point: Waypoint | null,
  distanceM: number,
): WaypointInput {
  return {
    kind:
      point?.kind === "start" || point?.kind === "finish"
        ? "aid"
        : (point?.kind ?? "aid"),
    name: point?.name ?? "Nouveau point",
    distanceM: point?.distanceM ?? distanceM,
    cutoffMinutes: point?.cutoffMinutes ?? null,
    services: point?.services ?? [],
    watchLabel: point?.watchLabel ?? null,
    alertDistanceM: point?.alertDistanceM ?? 500,
    voiceNote: point?.voiceNote ?? null,
    todo: point?.todo ?? null,
    nutritionNote: point?.nutritionNote ?? null,
  };
}

function WaypointEditor({
  raceId,
  point,
  mark,
  pickedDistanceM,
  courseDistanceM,
  passage,
  onSaved,
  onDeleted,
}: {
  raceId: string;
  point: Waypoint | null;
  mark: WaypointMark | null;
  pickedDistanceM: number;
  courseDistanceM: number;
  passage: Passage | undefined;
  onSaved: (id: string | null) => void;
  onDeleted: () => void;
}) {
  const [input, setInput] = useState(() =>
    initialInput(point, pickedDistanceM),
  );
  const [km, setKm] = useState(() =>
    formatKm(point?.distanceM ?? pickedDistanceM),
  );
  const [cutoff, setCutoff] = useState(() =>
    point?.cutoffMinutes == null ? "" : formatClock(point.cutoffMinutes),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof WaypointInput>(
    key: K,
    value: WaypointInput[K],
  ) => setInput((current) => ({ ...current, [key]: value }));

  function save() {
    const meters = parseKm(km);
    const minutes = cutoff.trim() ? parseClock(cutoff) : null;
    if (
      meters === null ||
      meters < 0 ||
      meters > courseDistanceM ||
      (cutoff.trim() && minutes === null)
    )
      return setError("Vérifie le kilomètre et la barrière horaire.");
    startTransition(async () => {
      const result = await saveWaypoint(raceId, point?.id ?? null, {
        ...input,
        distanceM: meters,
        cutoffMinutes: minutes,
      });
      if (result.status === "saved") {
        setError(null);
        onSaved(result.id ?? point?.id ?? null);
      } else setError(actionMessage(result.status));
    });
  }

  function remove() {
    if (!point) return;
    startTransition(async () => {
      const result = await deleteWaypoint(raceId, point.id);
      if (result.status === "saved") onDeleted();
      else setError(actionMessage(result.status));
    });
  }

  return (
    <RaceCard className="gap-5 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-3">
        <CardLabel>
          {point ? `Modifier · ${point.name}` : "Ajouter un point"}
        </CardLabel>
        <button
          type="button"
          onClick={onDeleted}
          className="text-sm text-muted hover:text-foreground"
        >
          Fermer
        </button>
      </div>
      <div className="space-y-2">
        <MonoLabel size="micro">Type</MonoLabel>
        <div className="flex flex-wrap gap-2">
          {editableKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={input.kind === kind}
              onClick={() => set("kind", kind)}
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-muted hover:text-foreground aria-pressed:border-accent aria-pressed:text-foreground"
            >
              {kindLabels[kind]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <label className="space-y-2">
          <MonoLabel size="micro">Nom</MonoLabel>
          <Input
            value={input.name}
            maxLength={60}
            onChange={(event) => set("name", event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <MonoLabel size="micro">Km</MonoLabel>
          <Input
            value={km}
            inputMode="decimal"
            onChange={(event) => setKm(event.target.value)}
          />
        </label>
      </div>
      <label className="block space-y-2">
        <MonoLabel size="micro">Barrière horaire</MonoLabel>
        <Input
          value={cutoff}
          placeholder="HH:MM"
          inputMode="numeric"
          onChange={(event) => setCutoff(event.target.value)}
        />
        {passage?.marginSeconds != null && (
          <span className="text-xs text-success">
            Marge prévue {formatMargin(passage.marginSeconds)}
          </span>
        )}
      </label>
      <div className="space-y-2">
        <MonoLabel size="micro">Services</MonoLabel>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <button
              type="button"
              key={service}
              aria-pressed={input.services.includes(service)}
              onClick={() =>
                set(
                  "services",
                  input.services.includes(service)
                    ? input.services.filter((item) => item !== service)
                    : [...input.services, service],
                )
              }
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-muted hover:text-foreground aria-pressed:border-accent aria-pressed:text-foreground"
            >
              {serviceLabels[service]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-t border-border pt-4">
        <CardLabel>Sur la montre</CardLabel>
        <label className="block space-y-2">
          <MonoLabel size="micro">Nom affiché</MonoLabel>
          <Input
            value={input.watchLabel ?? ""}
            maxLength={24}
            placeholder={
              point && mark ? defaultWatchLabel(point, mark) : "Nom du point"
            }
            onChange={(event) => set("watchLabel", event.target.value || null)}
          />
          <span className="text-xs text-muted">
            {(input.watchLabel ?? "").length} / 24 caractères
          </span>
        </label>
        <label className="block space-y-2">
          <MonoLabel size="micro">Prévenir avant</MonoLabel>
          <select
            aria-label="Distance de l’alerte"
            className="flex h-9 w-full rounded-control border border-border-strong bg-surface-inset px-3 text-sm"
            value={input.alertDistanceM}
            onChange={(event) =>
              set(
                "alertDistanceM",
                Number(event.target.value) as WaypointInput["alertDistanceM"],
              )
            }
          >
            {alertDistances.map((distance) => (
              <option key={distance} value={distance}>
                {distance === 0 ? "Au point" : `${distance} m avant`}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <MonoLabel size="micro">Consigne vocale</MonoLabel>
          <Textarea
            value={input.voiceNote ?? ""}
            maxLength={280}
            onChange={(event) => set("voiceNote", event.target.value || null)}
          />
        </label>
      </div>
      <label className="block space-y-2">
        <MonoLabel size="micro">À faire</MonoLabel>
        <Textarea
          value={input.todo ?? ""}
          maxLength={400}
          onChange={(event) => set("todo", event.target.value || null)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {point ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={remove}
          >
            Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" disabled={pending} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </RaceCard>
  );
}

export function WaypointWorkspace({
  raceId,
  waypoints,
  marks,
  profile,
  passages,
  distanceM,
}: {
  raceId: string;
  waypoints: Waypoint[];
  marks: WaypointMark[];
  profile: ProfileData;
  passages: Passage[];
  distanceM: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDistance, setNewDistance] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = waypoints.find((point) => point.id === selectedId) ?? null;
  const selectedIndex = selected ? waypoints.indexOf(selected) : -1;
  const count = waypoints.filter(
    (point) =>
      point.kind !== "start" &&
      point.kind !== "finish" &&
      point.kind !== "instruction" &&
      point.kind !== "caution",
  ).length;
  const instructions = waypoints.filter(
    (point) => point.kind === "instruction" || point.kind === "caution",
  ).length;

  function importRoadbook(body: FormData) {
    startTransition(async () => {
      const response = await fetch(`/api/races/${raceId}/roadbook`, {
        method: "POST",
        body,
      });
      const result = (await response
        .json()
        .catch(() => ({ status: "error" }))) as {
        status: string;
        points?: number;
        review?: string[];
      };
      if (result.status === "roadbook-saved") {
        setMessage(
          `${result.points ?? 0} points importés.${result.review?.length ? ` ${result.review.length} position(s) à vérifier.` : ""}`,
        );
        router.refresh();
      } else setMessage(importMessage(result.status));
    });
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <div className="min-w-0 space-y-5">
        <RaceCard id="import-roadbook" className="gap-3">
          <CardLabel>GPX importé</CardLabel>
          <p className="text-sm text-muted">
            {count
              ? `${count} points de passage sur le tracé. Ajoute tes consignes ou complète les détails du roadbook.`
              : "Le GPX ne contient aucun point de passage. Clique sur le profil pour en ajouter, ou importe le roadbook de la course."}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="Choisir un roadbook PDF"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const body = new FormData();
                  body.set("file", file);
                  importRoadbook(body);
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon />
              Importer le roadbook PDF
            </Button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const body = new FormData();
              body.set("intent", "roadbook");
              body.set("link", link);
              importRoadbook(body);
            }}
          >
            <Input
              type="url"
              required
              placeholder="Lien https vers le roadbook"
              aria-label="Lien vers le roadbook"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending}
            >
              Importer
            </Button>
          </form>
          {message && (
            <p role="status" className="text-xs text-muted">
              {message}
            </p>
          )}
        </RaceCard>
        <RaceCard className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardLabel>
              Points de passage · {count} points + {instructions} consignes
            </CardLabel>
            <MonoLabel size="micro">
              Clique sur le profil pour placer un point
            </MonoLabel>
          </div>
          <ProfileChart
            data={profile}
            variant="editor"
            activeId={selectedId}
            onPick={(distance) => {
              setSelectedId(null);
              setNewDistance(Math.round(distance));
            }}
            label="Profil altimétrique interactif : cliquer pour ajouter un point"
          />
          {newDistance !== null && (
            <p className="text-xs text-accent">
              Nouveau point au km {formatKm(newDistance)}. Complète le
              formulaire pour l’enregistrer.
            </p>
          )}
        </RaceCard>
        <RaceCard className="gap-3">
          <CardLabel>Envoyer à ta montre</CardLabel>
          <p className="text-sm text-muted">
            Télécharge la course avec les points, les consignes et leurs
            alertes, puis importe-la dans Garmin Connect, rubrique Parcours.
            Stride n’écrit pas sur ton compte Garmin.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/races/${raceId}/export?format=gpx`}>
                <DownloadIcon />
                GPX enrichi
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={`/api/races/${raceId}/export?format=fit`}>
                <DownloadIcon />
                Course .fit
              </a>
            </Button>
          </div>
        </RaceCard>
      </div>
      <div className="min-w-0 space-y-5">
        <RaceCard className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardLabel>Points de passage</CardLabel>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedId(null);
                setNewDistance(0);
              }}
            >
              <PlusIcon />
              Ajouter
            </Button>
          </div>
          <ol className="space-y-1">
            {waypoints.map((point, index) => {
              const mark = marks[index];
              const fixed = point.kind === "start" || point.kind === "finish";
              return (
                <li key={point.id}>
                  <button
                    type="button"
                    disabled={fixed}
                    onClick={() => {
                      setSelectedId(point.id);
                      setNewDistance(null);
                    }}
                    aria-current={selectedId === point.id ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-raised disabled:cursor-default disabled:hover:bg-transparent aria-current:bg-surface-raised"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong font-metric text-sm">
                      {mark.shape === "circle" || mark.shape === "square"
                        ? mark.label
                        : "◇"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {point.name}
                      </span>
                      <span className="block text-xs text-muted">
                        km {formatKm(point.distanceM)}
                        {point.cutoffMinutes !== null
                          ? ` · BH ${formatClock(point.cutoffMinutes)}`
                          : ""}
                        {point.needsReview ? " · À vérifier" : ""}
                      </span>
                    </span>
                    {point.alertDistanceM > 0 && (
                      <span className="font-mono text-[9px] text-muted uppercase">
                        Alerte
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </RaceCard>
        {(selected || newDistance !== null) && (
          <WaypointEditor
            key={selected?.id ?? `new-${newDistance}`}
            raceId={raceId}
            point={selected}
            mark={selectedIndex >= 0 ? marks[selectedIndex] : null}
            pickedDistanceM={newDistance ?? selected?.distanceM ?? 0}
            courseDistanceM={distanceM}
            passage={passages.find(
              (passage) => passage.waypointId === selected?.id,
            )}
            onSaved={(id) => {
              setSelectedId(id);
              setNewDistance(null);
              router.refresh();
            }}
            onDeleted={() => {
              setSelectedId(null);
              setNewDistance(null);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
