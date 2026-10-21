"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { ProfileChart } from "./profile-chart";
import { RaceMap, type MapLayers } from "./race-map";
import { CardLabel, RaceCard } from "./race-ui";
import { actionMessage, importMessage } from "../messages";
import {
  formatClock,
  formatKm,
  formatMargin,
  parseClock,
  parseKm,
} from "../format";
import type { MapData } from "../map";
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

const mapLayers: MapLayers = {
  markers: true,
  walk: false,
  night: true,
  rain: false,
};

const chipClass =
  "min-h-10 rounded-full border border-border-strong px-3 text-meta font-normal text-muted hover:border-dim hover:text-foreground data-[state=on]:border-dim data-[state=on]:bg-surface-raised data-[state=on]:text-foreground lg:min-h-8";

function counted(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("fr-FR")} ${count > 1 ? plural : singular}`;
}

function isInstruction(point: Pick<Waypoint, "kind">) {
  return point.kind === "instruction" || point.kind === "caution";
}

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

function WaypointBadge({
  mark,
  active,
}: {
  mark: WaypointMark;
  active: boolean;
}) {
  if (mark.shape === "diamond" || mark.shape === "triangle")
    return (
      <span
        aria-hidden="true"
        className="flex size-5.5 items-center justify-center"
      >
        <span
          className={cn(
            "size-2.75 rotate-45 border-[1.6px]",
            mark.shape === "triangle"
              ? "border-muted"
              : mark.tone === "caution"
                ? "border-warning"
                : "border-night",
          )}
        />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5.5 items-center justify-center border-[1.4px] font-metric text-xs leading-none font-bold",
        mark.shape === "square" ? "rounded-control" : "rounded-full",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : mark.shape === "square"
            ? "border-provider bg-surface-inset text-foreground"
            : "border-foreground bg-surface-inset text-foreground",
      )}
    >
      {mark.label}
    </span>
  );
}

function WaypointRow({
  point,
  mark,
  active,
  onSelect,
}: {
  point: Waypoint;
  mark: WaypointMark;
  active: boolean;
  onSelect: () => void;
}) {
  const instruction = isInstruction(point);
  const details = [
    `km ${formatKm(point.distanceM)}`,
    instruction ? point.name : null,
    point.cutoffMinutes !== null
      ? `BH ${formatClock(point.cutoffMinutes)}`
      : null,
    point.needsReview ? "À vérifier" : null,
  ].filter(Boolean);
  const signal = instruction
    ? point.voiceNote
      ? "Vocal"
      : null
    : point.kind !== "start" && point.alertDistanceM > 0
      ? "Alerte"
      : null;
  const content = (
    <>
      <WaypointBadge mark={mark} active={active} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate text-sm",
            active ? "font-semibold" : "font-medium",
            point.kind === "caution" && "text-warning",
            point.kind === "instruction" && "text-night",
          )}
        >
          {instruction ? kindLabels[point.kind] : point.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {details.join(" · ")}
        </span>
      </span>
      <MonoLabel size="nano">{signal}</MonoLabel>
    </>
  );
  const rowClass =
    "grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-surface px-2.5 py-2.25 text-left";
  if (point.kind === "start" || point.kind === "finish")
    return <div className={rowClass}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        rowClass,
        "transition-colors duration-150 ease-stride hover:bg-surface-raised aria-current:bg-surface-raised",
      )}
    >
      {content}
    </button>
  );
}

function WatchPreview({
  label,
  alertDistanceM,
  distanceM,
}: {
  label: string;
  alertDistanceM: number;
  distanceM: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex size-33 shrink-0 flex-col items-center justify-center gap-1 rounded-full border-6 border-border bg-background px-3 text-center"
    >
      <span className="font-mono text-[0.5rem] tracking-[0.08em] text-muted-foreground uppercase">
        {alertDistanceM === 0
          ? "Au point"
          : `Dans ${alertDistanceM.toLocaleString("fr-FR")} m`}
      </span>
      <span className="font-metric text-[1.0625rem] leading-none font-bold break-all text-foreground">
        {label}
      </span>
      <span className="font-metric text-xs text-accent">
        km {formatKm(distanceM)}
      </span>
    </div>
  );
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
  const fallbackLabel =
    point && mark ? defaultWatchLabel(point, mark) : input.name.slice(0, 24);
  const watchLabel = input.watchLabel ?? fallbackLabel;
  const previewDistance = parseKm(km) ?? point?.distanceM ?? pickedDistanceM;

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
    setError(null);
    startTransition(async () => {
      const result = await saveWaypoint(raceId, point?.id ?? null, {
        ...input,
        distanceM: meters,
        cutoffMinutes: minutes,
      });
      if (result.status === "saved") {
        toast.success("Point enregistré.");
        onSaved(result.id ?? point?.id ?? null);
      } else toast.error(actionMessage(result.status));
    });
  }

  function remove() {
    if (!point) return;
    startTransition(async () => {
      const result = await deleteWaypoint(raceId, point.id);
      if (result.status === "saved") {
        toast.success("Point supprimé.");
        onDeleted();
      } else toast.error(actionMessage(result.status));
    });
  }

  return (
    <section
      aria-label={point ? `Modifier ${point.name}` : "Ajouter un point"}
      className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-dim bg-surface px-4 py-4.5 lg:rounded-none lg:border-0 lg:border-t lg:border-border-strong lg:bg-transparent lg:px-0 lg:pt-4 lg:pb-0"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lead font-semibold lg:text-base">
          {point ? `Modifier · ${point.name}` : "Ajouter un point"}
        </h3>
        <MonoLabel size="nano" className="lg:hidden">
          km {formatKm(previewDistance)}
        </MonoLabel>
      </div>
      <div className="flex flex-col gap-1.5">
        <MonoLabel size="micro" id="waypoint-kind">
          Type
        </MonoLabel>
        <div
          role="group"
          aria-labelledby="waypoint-kind"
          className="flex flex-wrap gap-1.5"
        >
          {editableKinds.map((kind) => (
            <Toggle
              key={kind}
              variant="segment"
              pressed={input.kind === kind}
              onPressedChange={() => set("kind", kind)}
              className={chipClass}
            >
              {kindLabels[kind]}
            </Toggle>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-full flex flex-col gap-1.5">
          <MonoLabel size="micro">Nom</MonoLabel>
          <Input
            value={input.name}
            maxLength={60}
            className="h-10 rounded-surface bg-surface-panel text-sm md:h-10 md:text-sm"
            onChange={(event) => set("name", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <MonoLabel size="micro">Km</MonoLabel>
          <Input
            value={km}
            inputMode="decimal"
            className="h-10 rounded-surface bg-surface-panel text-sm md:h-10 md:text-sm"
            onChange={(event) => setKm(event.target.value)}
          />
          <span className="text-[0.6875rem] text-muted-foreground">
            Accroché au tracé
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <MonoLabel size="micro">Barrière horaire</MonoLabel>
          <Input
            value={cutoff}
            placeholder="HH:MM"
            inputMode="numeric"
            className="h-10 rounded-surface bg-surface-panel text-sm md:h-10 md:text-sm"
            onChange={(event) => setCutoff(event.target.value)}
          />
          {passage?.marginSeconds != null && (
            <span
              className={cn(
                "text-[0.6875rem]",
                passage.marginSeconds < 0 ? "text-danger" : "text-success",
              )}
            >
              Marge prévue {formatMargin(passage.marginSeconds)}
            </span>
          )}
        </label>
      </div>
      <fieldset className="flex flex-col gap-1">
        <MonoLabel size="micro" asChild>
          <legend>Services</legend>
        </MonoLabel>
        <div className="flex flex-wrap gap-x-3.5">
          {services.map((service) => (
            <label
              key={service}
              className="inline-flex min-h-11 items-center gap-1.5 text-meta text-muted lg:min-h-7.5"
            >
              <Checkbox
                checked={input.services.includes(service)}
                onCheckedChange={(checked) =>
                  set(
                    "services",
                    checked === true
                      ? [...input.services, service]
                      : input.services.filter((item) => item !== service),
                  )
                }
              />
              {serviceLabels[service]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2.5 border-t border-border pt-3.5">
        <MonoLabel size="micro">Sur la montre</MonoLabel>
        <div className="flex items-center gap-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <label className="flex flex-col gap-1.5">
              <MonoLabel size="micro">Nom affiché</MonoLabel>
              <Input
                value={input.watchLabel ?? ""}
                maxLength={24}
                placeholder={fallbackLabel}
                className="h-10 rounded-surface bg-surface-panel text-sm md:h-10 md:text-sm"
                onChange={(event) =>
                  set("watchLabel", event.target.value || null)
                }
              />
              <span className="text-[0.6875rem] text-muted-foreground">
                {counted(watchLabel.length, "caractère", "caractères")} · reste
                court, la montre coupe les noms longs
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <MonoLabel size="micro">Prévenir</MonoLabel>
              <select
                className="h-10 w-full rounded-surface border border-input bg-surface-panel px-3 text-sm"
                value={input.alertDistanceM}
                onChange={(event) =>
                  set(
                    "alertDistanceM",
                    Number(
                      event.target.value,
                    ) as WaypointInput["alertDistanceM"],
                  )
                }
              >
                {alertDistances.map((distance) => (
                  <option key={distance} value={distance}>
                    {distance === 0
                      ? "Au point"
                      : `${distance.toLocaleString("fr-FR")} m avant`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <WatchPreview
            label={watchLabel}
            alertDistanceM={input.alertDistanceM}
            distanceM={previewDistance}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <MonoLabel size="micro">Consigne vocale</MonoLabel>
          <Textarea
            value={input.voiceNote ?? ""}
            maxLength={280}
            className="min-h-16 rounded-surface bg-surface-panel text-sm"
            onChange={(event) => set("voiceNote", event.target.value || null)}
          />
          <span className="text-[0.6875rem] text-muted-foreground">
            Lue à voix haute sur les montres et téléphones qui le permettent,
            affichée sinon.
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <MonoLabel size="micro">À faire</MonoLabel>
        <Textarea
          value={input.todo ?? ""}
          maxLength={400}
          className="min-h-16 rounded-surface bg-surface-panel text-sm"
          onChange={(event) => set("todo", event.target.value || null)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2 lg:justify-between">
        {point && (
          <Button
            type="button"
            variant="destructive"
            size="md"
            disabled={pending}
            onClick={remove}
            className="min-h-11 flex-1 font-normal lg:min-h-9.5 lg:flex-none"
          >
            Supprimer
          </Button>
        )}
        <Button
          type="button"
          size="md"
          disabled={pending}
          onClick={save}
          className="min-h-11 flex-1 lg:ml-auto lg:min-h-9.5 lg:flex-none"
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}

function RoadbookImport({ raceId, count }: { raceId: string; count: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [pending, startTransition] = useTransition();

  function importRoadbook(body: FormData) {
    setOpen(false);
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
        cutoffs?: number;
        review?: string[];
      };
      if (result.status === "roadbook-saved") {
        const points = result.points ?? 0;
        const cutoffs = result.cutoffs ?? 0;
        const review = result.review ?? [];
        const found = cutoffs
          ? `${counted(points, "point", "points")} et ${counted(cutoffs, "barrière", "barrières")}`
          : counted(points, "point", "points");
        toast.success(
          `${found} ${points + cutoffs > 1 ? "trouvés et placés" : "trouvé et placé"} sur le tracé.`,
          review.length
            ? {
                description: `${counted(review.length, "position", "positions")} à vérifier (${review.join(", ")}).`,
              }
            : undefined,
        );
        router.refresh();
      } else toast.error(importMessage(result.status));
    });
  }

  return (
    <RaceCard
      id="import-roadbook"
      className="gap-2.5 border-dim px-4 py-4.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5 lg:px-6 lg:py-5.5"
    >
      <MonoLabel
        size="nano"
        className="lg:tracking-label flex items-center gap-2 lg:text-label"
        asChild
      >
        <h2>
          <StrideMark className="size-3.5 shrink-0" />
          GPX importé
        </h2>
      </MonoLabel>
      <p className="text-sm/[1.55] text-muted lg:flex-[1_1_420px]">
        {count ? (
          <>
            <b className="font-semibold text-foreground">
              {counted(count, "point de passage", "points de passage")}
            </b>{" "}
            sur le tracé.
          </>
        ) : (
          <>
            Le GPX ne contient{" "}
            <b className="font-semibold text-foreground">
              aucun point de passage
            </b>
            .
          </>
        )}{" "}
        <span className="lg:hidden">
          Touche le tracé pour en ajouter, ou importe le roadbook de la course.
        </span>
        <span className="max-lg:hidden">
          Clique sur le profil ou la carte pour en ajouter, ou laisse Stride les
          lire dans le roadbook de la course.
        </span>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Choisir un roadbook PDF"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            const body = new FormData();
            body.set("file", file);
            importRoadbook(body);
          }
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="md"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 text-meta lg:min-h-9.5"
          >
            Importer le roadbook (PDF ou lien)
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer le roadbook</DialogTitle>
            <DialogDescription>
              Stride lit les points de passage et les barrières horaires, puis
              les place sur le tracé.
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon />
            Choisir un PDF
          </Button>
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
              className="h-10 text-sm md:h-10 md:text-sm"
              onChange={(event) => setLink(event.target.value)}
            />
            <Button type="submit" variant="outline" size="md">
              Importer
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {pending && (
        <p
          role="status"
          className="text-xs text-muted-foreground lg:basis-full"
        >
          Lecture du roadbook…
        </p>
      )}
    </RaceCard>
  );
}

function WatchExport({
  raceId,
  points,
  instructions,
  compact,
}: {
  raceId: string;
  points: number;
  instructions: number;
  compact: boolean;
}) {
  const contents = instructions
    ? `${points > 1 ? `les ${points} points` : "le point"}, ${instructions > 1 ? `les ${instructions} consignes` : "la consigne"}`
    : points > 1
      ? `les ${points} points`
      : "le point";
  if (compact)
    return (
      <RaceCard className="gap-2.5 px-4 py-4.5 lg:hidden">
        <h2 className="text-body font-semibold">Envoyer à ta montre</h2>
        <p className="text-meta text-muted-foreground">
          Course .fit avec les points, les consignes et leurs alertes, à
          importer dans Garmin Connect. Stride n’écrit jamais sur ton compte
          Garmin.
        </p>
        <Button asChild size="md" className="min-h-12">
          <a href={`/api/races/${raceId}/export?format=fit`}>
            <DownloadIcon />
            Télécharger la course .fit
          </a>
        </Button>
      </RaceCard>
    );
  return (
    <RaceCard className="flex-row flex-wrap items-center gap-5 max-lg:hidden">
      <div className="flex flex-[1_1_380px] flex-col gap-1">
        <h2 className="text-body font-semibold">Envoyer à ta montre</h2>
        <p className="text-meta text-muted-foreground">
          Télécharge la course au format .fit, avec {contents} et leurs alertes.
          Importe-la ensuite dans Garmin Connect, rubrique Parcours. Stride
          n’écrit jamais sur ton compte Garmin.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild size="md" variant="outline" className="text-meta">
          <a href={`/api/races/${raceId}/export?format=gpx`}>
            <DownloadIcon />
            GPX enrichi
          </a>
        </Button>
        <Button asChild size="md" className="text-meta">
          <a href={`/api/races/${raceId}/export?format=fit`}>
            <DownloadIcon />
            Course .fit
          </a>
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
  map,
  passages,
  distanceM,
}: {
  raceId: string;
  waypoints: Waypoint[];
  marks: WaypointMark[];
  profile: ProfileData;
  map: MapData;
  passages: Passage[];
  distanceM: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDistance, setNewDistance] = useState<number | null>(null);
  const selected = waypoints.find((point) => point.id === selectedId) ?? null;
  const selectedIndex = selected ? waypoints.indexOf(selected) : -1;
  const stations = waypoints.filter(
    (point) =>
      point.kind !== "start" &&
      point.kind !== "finish" &&
      !isInstruction(point),
  ).length;
  const instructions = waypoints.filter(isInstruction).length;
  const points = waypoints.length - instructions;
  const summary = `${counted(points, "point", "points")} · ${counted(instructions, "consigne", "consignes")}`;
  const pick = (distance: number) => {
    setSelectedId(null);
    setNewDistance(Math.round(distance));
  };
  const select = (id: string) => {
    const point = waypoints.find((item) => item.id === id);
    if (!point || point.kind === "start" || point.kind === "finish") return;
    setNewDistance(null);
    setSelectedId((current) => (current === id ? null : id));
  };
  const editing = selected !== null || newDistance !== null;

  return (
    <div className="flex flex-col gap-5">
      <RoadbookImport raceId={raceId} count={stations} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4.5 py-3.5 max-lg:hidden">
              <MonoLabel>Clique sur le tracé pour ajouter un point</MonoLabel>
              <MonoLabel size="micro">{summary}</MonoLabel>
            </div>
            <RaceMap
              data={map}
              layers={mapLayers}
              activeId={selectedId}
              onSelect={select}
              onPick={pick}
              label={`Carte du parcours, ${formatKm(map.distanceM)} km, ${map.markers.length} points de passage`}
              className="h-50 lg:h-62.5"
            />
          </section>
          <RaceCard className="relative max-md:hidden">
            <CardLabel>Profil · survole pour placer un point</CardLabel>
            <ProfileChart
              data={profile}
              variant="editor"
              activeId={selectedId}
              onPick={pick}
              label="Profil altimétrique interactif : cliquer pour ajouter un point"
            />
          </RaceCard>
          <WatchExport
            raceId={raceId}
            points={points}
            instructions={instructions}
            compact={false}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-5 lg:gap-3.5 lg:rounded-panel lg:border lg:border-border lg:bg-surface lg:p-4">
          <section className="flex min-w-0 flex-col gap-1 rounded-panel border border-border bg-surface p-3 lg:gap-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            <div className="flex items-center justify-between gap-3 px-1 pb-1.5 lg:p-0">
              <MonoLabel size="nano" className="lg:text-label" asChild>
                <h2>
                  <span className="max-lg:sr-only">Points de passage</span>
                  <span className="lg:hidden"> {summary}</span>
                </h2>
              </MonoLabel>
              <Toggle
                variant="segment"
                pressed={newDistance !== null}
                onPressedChange={(pressed) => {
                  setSelectedId(null);
                  setNewDistance(pressed ? 0 : null);
                }}
                className={chipClass}
              >
                + Ajouter
              </Toggle>
            </div>
            <ol className="flex flex-col">
              {waypoints.map((point, index) => (
                <li key={point.id}>
                  <WaypointRow
                    point={point}
                    mark={marks[index]}
                    active={selectedId === point.id}
                    onSelect={() => select(point.id)}
                  />
                </li>
              ))}
            </ol>
          </section>
          {editing && (
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
        </aside>
        <WatchExport
          raceId={raceId}
          points={points}
          instructions={instructions}
          compact
        />
      </div>
    </div>
  );
}
