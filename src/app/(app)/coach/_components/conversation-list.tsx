"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type {
  ConversationRow,
  ConversationSection,
} from "@/features/coach/conversations";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { ThreadStatusLabel } from "@/features/coach/components/thread-status";

type Filter = "all" | "mine";

function needsAthlete(row: ConversationRow) {
  return row.status === "question" || row.status === "proposal";
}

function RowAvatar({ row }: { row: ConversationRow }) {
  const specialist = row.participants.find((agent) => agent !== "coach");
  if (!specialist) return <StaffPortrait agent="coach" size={40} />;
  return (
    <span className="relative block size-10">
      <StaffPortrait agent="coach" size={30} />
      <span className="absolute -right-0.5 -bottom-0.5 rounded-[9px] ring-2 ring-surface-inset">
        <StaffPortrait agent={specialist} size={22} decorative />
      </span>
    </span>
  );
}

function Row({ row, current }: { row: ConversationRow; current: boolean }) {
  return (
    <Link
      href={`/coach/${row.id}`}
      aria-current={current ? "page" : undefined}
      className={cn(
        "grid min-h-11 grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-[10px] px-3.5 py-3 text-foreground hover:bg-surface-raised/60 focus-visible:outline-2 focus-visible:outline-ring",
        current && "bg-surface-current ring-1 ring-border ring-inset",
      )}
    >
      <RowAvatar row={row} />
      <span className="flex min-w-0 flex-col gap-0.75">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "flex-1 truncate text-sm",
              row.unread ? "font-semibold" : "font-medium",
            )}
          >
            {row.title}
          </span>
          <MonoLabel size="nano" className="shrink-0">
            {row.date}
          </MonoLabel>
          {row.unread && (
            <span className="size-2 shrink-0 self-center rounded-full bg-accent">
              <span className="sr-only">Non lu</span>
            </span>
          )}
        </span>
        {row.preview && (
          <span className="line-clamp-2 text-meta leading-snug text-muted-foreground">
            {row.preview}
          </span>
        )}
        <ThreadStatusLabel status={row.status} />
      </span>
    </Link>
  );
}

export function ConversationList({
  sections,
  currentId,
  mobileHeader,
}: {
  sections: ConversationSection[];
  currentId: string | null;
  mobileHeader?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const waiting = sections
    .flatMap((section) => section.rows)
    .filter(needsAthlete).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");
    return sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter(
          (row) =>
            (filter === "all" || needsAthlete(row)) &&
            (!query ||
              `${row.title} ${row.preview}`
                .toLocaleLowerCase("fr-FR")
                .includes(query)),
        ),
      }))
      .filter((section) => section.rows.length > 0);
  }, [sections, filter, search]);
  const empty = sections.length === 0;

  return (
    <section
      aria-label="Conversations"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-2.5 min-[980px]:px-3.5">
        {mobileHeader}
        <div
          className={cn(
            "flex items-center gap-2",
            mobileHeader && "max-[979px]:hidden",
          )}
        >
          <h2 className="text-lead font-semibold">Conversations</h2>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-auto h-8 rounded-surface px-2.5"
          >
            <Link href="/coach/nouvelle">
              <PlusIcon aria-hidden="true" />
              Nouvelle
            </Link>
          </Button>
        </div>
        {!empty && (
          <>
            <InputGroup className="h-9 rounded-surface border-border md:h-9">
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Rechercher une conversation"
                placeholder="Rechercher"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-meta"
              />
            </InputGroup>
            <ToggleGroup
              type="single"
              variant="choice"
              aria-label="Filtrer"
              value={filter}
              onValueChange={(value) => value && setFilter(value as Filter)}
              className="flex-nowrap gap-1.5"
            >
              <ToggleGroupItem
                value="all"
                className="min-h-9 rounded-full border-border bg-transparent text-meta"
              >
                Toutes
              </ToggleGroupItem>
              <ToggleGroupItem
                value="mine"
                className="min-h-9 rounded-full border-border bg-transparent text-meta"
              >
                À toi · {waiting}
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1.5 pb-3">
        {empty && (
          <p className="px-3.5 py-6 text-sm text-muted-foreground">
            Aucune conversation pour l’instant. Écris à Claire pour commencer.
          </p>
        )}
        {!empty && visible.length === 0 && (
          <p className="px-3.5 py-6 text-sm text-muted-foreground">
            Aucune conversation ne correspond.
          </p>
        )}
        {visible.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <MonoLabel size="micro" className="px-3.5 pt-2.5 pb-0.5">
              {section.label}
            </MonoLabel>
            {section.rows.map((row) => (
              <Row key={row.id} row={row} current={row.id === currentId} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
