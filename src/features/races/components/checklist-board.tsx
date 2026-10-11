"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  type ChecklistItem,
  type ChecklistList,
  type ItemStatus,
  checklistTemplates,
  listTitles,
  statusLabels,
} from "@/features/races/checklists";
import {
  addChecklistItem,
  applyChecklistTemplate,
  deleteChecklistItem,
  updateChecklistItem,
} from "@/server/races/actions";
import { RaceCard } from "./race-ui";

type Props = {
  raceId: string;
  lists: readonly ChecklistList[];
  items: ChecklistItem[];
  compact?: boolean;
};

const errors = {
  invalid: "Vérifie les informations saisies.",
  conflict: "Cette liste a déjà été remplie.",
  missing: "Cet élément n’existe plus.",
  error: "L’enregistrement a échoué. Réessaie.",
  "session-expired": "Ta session a expiré. Reconnecte-toi.",
  "no-track": "Le parcours est indisponible.",
} as const;

function ChecklistCard({
  raceId,
  list,
  initial,
}: {
  raceId: string;
  list: ChecklistList;
  initial: ChecklistItem[];
}) {
  const [items, setItems] = useState(initial);
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const hasTemplate = Boolean(checklistTemplates[list]);
  const router = useRouter();

  function toggle(item: ChecklistItem, checked: boolean) {
    const before = items;
    const status: ItemStatus | null = checked
      ? "ready"
      : list.startsWith("gear_")
        ? "check"
        : null;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, checked, status } : entry,
      ),
    );
    start(async () => {
      const result = await updateChecklistItem(raceId, item.id, {
        checked,
        status,
      });
      if (result.status !== "saved") {
        setItems(before);
        setError(errors[result.status]);
      } else {
        setError("");
        router.refresh();
      }
    });
  }

  function add() {
    const value = label.trim();
    if (!value) return;
    start(async () => {
      const result = await addChecklistItem(raceId, list, {
        label: value,
        detail: detail.trim() || null,
        status: null,
        startDate: startDate || null,
        endDate: null,
      });
      if (result.status === "saved") {
        setLabel("");
        setDetail("");
        setStartDate("");
        setError("");
        router.refresh();
      } else setError(errors[result.status]);
    });
  }

  function applyTemplate() {
    start(async () => {
      const result = await applyChecklistTemplate(raceId, list);
      if (result.status === "saved") router.refresh();
      else setError(errors[result.status]);
    });
  }

  function remove(item: ChecklistItem) {
    const before = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    start(async () => {
      const result = await deleteChecklistItem(raceId, item.id);
      if (result.status !== "saved") {
        setItems(before);
        setError(errors[result.status]);
      } else {
        setError("");
        router.refresh();
      }
    });
  }

  function changeStatus(item: ChecklistItem, status: ItemStatus | null) {
    const before = items;
    const checked = status === "ready";
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status, checked } : entry,
      ),
    );
    start(async () => {
      const result = await updateChecklistItem(raceId, item.id, {
        status,
        checked,
      });
      if (result.status !== "saved") {
        setItems(before);
        setError(errors[result.status]);
      } else {
        setError("");
        router.refresh();
      }
    });
  }

  return (
    <RaceCard className="gap-2">
      <div className="flex items-start justify-between gap-3 pb-1">
        <MonoLabel asChild>
          <h2>
            {listTitles[list]}
            {list === "gear_mandatory" && (
              <span className="block text-[9px] tracking-normal normal-case">
                Liste type à vérifier avec le règlement de ta course
              </span>
            )}
          </h2>
        </MonoLabel>
        <span className="font-metric text-lg text-muted tabular-nums">
          {items.filter((item) => item.checked).length}/{items.length}
        </span>
      </div>
      {items.length === 0 && hasTemplate && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={applyTemplate}
          className="self-start"
        >
          Utiliser la liste type
        </Button>
      )}
      {items.length === 0 && !hasTemplate && (
        <p className="text-sm text-muted">Aucun élément pour le moment.</p>
      )}
      <div className="flex flex-col">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-3 border-t border-border-subtle py-3"
          >
            {list !== "gear_forbidden" && (
              <Checkbox
                aria-label={`${item.checked ? "Marquer comme à faire" : "Marquer comme prêt"} : ${item.label}`}
                checked={item.checked}
                disabled={pending}
                onCheckedChange={(value) => toggle(item, value === true)}
                className="mt-0.5 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={
                  item.checked
                    ? "text-sm text-muted line-through"
                    : "text-sm font-medium"
                }
              >
                {item.label}
              </p>
              {item.detail && (
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                  {item.detail}
                </p>
              )}
              {item.startDate && (
                <span className="mt-1 block text-xs text-muted">
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${item.startDate}T00:00:00Z`))}
                </span>
              )}
            </div>
            {list.startsWith("gear_") && list !== "gear_forbidden" && (
              <select
                aria-label={`Statut de ${item.label}`}
                value={item.status ?? ""}
                disabled={pending}
                onChange={(event) =>
                  changeStatus(
                    item,
                    event.target.value
                      ? (event.target.value as ItemStatus)
                      : null,
                  )
                }
                className="max-w-27 shrink-0 rounded-control border border-border bg-surface-raised px-1.5 py-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-ring sm:max-w-none"
              >
                <option value="">Statut</option>
                {Object.entries(statusLabels)
                  .filter(([value]) => value !== "forbidden")
                  .map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
              </select>
            )}
            <button
              type="button"
              aria-label={`Supprimer ${item.label}`}
              title={`Supprimer ${item.label}`}
              disabled={pending}
              onClick={() => remove(item)}
              className="rounded-control p-1 text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
        className="flex flex-col gap-2 border-t border-border-subtle pt-3"
      >
        <div className="flex gap-2">
          <Input
            aria-label={`Ajouter un élément à ${listTitles[list]}`}
            placeholder="Ajouter un élément"
            value={label}
            maxLength={120}
            disabled={pending}
            onChange={(event) => setLabel(event.target.value)}
            className="min-w-0"
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label={`Ajouter à ${listTitles[list]}`}
            disabled={pending || !label.trim()}
          >
            <PlusIcon />
          </Button>
        </div>
        {label && (
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Précision"
              placeholder="Précision facultative"
              value={detail}
              maxLength={240}
              disabled={pending}
              onChange={(event) => setDetail(event.target.value)}
              className="min-w-0 flex-1"
            />
            {list === "key_sessions" && (
              <Input
                type="date"
                aria-label="Date de la séance"
                value={startDate}
                disabled={pending}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-auto"
              />
            )}
          </div>
        )}
      </form>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </RaceCard>
  );
}

export function ChecklistBoard({
  raceId,
  lists,
  items,
  compact = false,
}: Props) {
  return (
    <div
      className={
        compact
          ? "grid items-start gap-5 md:grid-cols-3"
          : "grid items-start gap-5 lg:grid-cols-2"
      }
    >
      {lists.map((list) => {
        const initial = items.filter((item) => item.list === list);
        return (
          <ChecklistCard
            key={`${list}-${initial.map((item) => `${item.id}:${item.revision}:${item.checked}:${item.status}`).join(",")}`}
            raceId={raceId}
            list={list}
            initial={initial}
          />
        );
      })}
    </div>
  );
}
