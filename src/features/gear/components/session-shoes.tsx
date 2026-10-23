"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { MonoLabel } from "@/components/stride/mono-label";
import { NavGearIcon } from "@/components/stride/nav-icons";
import { cn } from "@/lib/utils";
import { chooseSessionShoe } from "@/server/gear/actions";
import { gearErrorMessage } from "../form";
import type { SessionShoesView } from "../planned";
import { theModel } from "../view";

function useChooseShoe(sessionKey: string) {
  const [pending, startTransition] = useTransition();
  const choose = (shoeId: string, name: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await chooseSessionShoe({ sessionKey, shoeId });
      if (result.status === "saved") {
        toast.success(`${name} pour cette séance.`);
        onDone?.();
      } else toast.error(gearErrorMessage(result));
    });
  return { pending, choose };
}

function Badge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.25 py-0.75 text-[11px] font-semibold whitespace-nowrap",
        label === "Réservée"
          ? "border border-border-strong font-normal text-muted"
          : "bg-accent text-accent-foreground",
      )}
    >
      {label}
    </span>
  );
}

export type PairSheetOption = {
  id: string;
  name: string;
  detail: string;
  sentence?: string;
  badge?: string | null;
};

export function PairSheet({
  title,
  context,
  note,
  options,
  initialId,
  pending,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  context: string;
  note: string;
  options: PairSheetOption[];
  initialId: string | null;
  pending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (option: PairSheetOption) => void;
}) {
  const [selected, setSelected] = useState(initialId);
  const option = options.find((item) => item.id === selected) ?? null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-3.5 rounded-t-[18px] border-border-strong bg-surface px-5 pt-2.5 pb-[max(1.875rem,env(safe-area-inset-bottom))] text-foreground sm:mx-auto sm:w-full sm:max-w-120"
      >
        <span
          aria-hidden="true"
          className="h-1 w-9 self-center rounded-mark bg-border-strong"
        />
        <div className="flex flex-col gap-1">
          <MonoLabel size="nano" className="text-[9.5px]">
            {context}
          </MonoLabel>
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
        </div>
        <fieldset className="flex max-h-[55dvh] flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">Paires actives</legend>
          {options.map((item) => (
            <label
              key={item.id}
              className={cn(
                "grid cursor-pointer grid-cols-[22px_minmax(0,1fr)] gap-3 rounded-card border p-3.5 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                selected === item.id ? "border-accent" : "border-border",
              )}
            >
              <input
                type="radio"
                name="pair"
                value={item.id}
                checked={selected === item.id}
                onChange={() => setSelected(item.id)}
                className="mt-0.5 size-4.5 accent-(--accent)"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto">
                      <Badge label={item.badge} />
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.detail}
                </span>
                {item.sentence && (
                  <span className="text-[13px] leading-[1.45] text-muted">
                    {item.sentence}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <SheetDescription className="text-xs leading-[1.45] text-muted-foreground">
          {note}
        </SheetDescription>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            className="h-12 flex-2"
            disabled={!option || pending}
            aria-busy={pending}
            onClick={() => {
              if (!option) return;
              if (option.id === initialId) onOpenChange(false);
              else onConfirm(option);
            }}
          >
            {option ? `Garder ${theModel(option.name)}` : "Choisir une paire"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ShoePicker({
  shoes,
  open,
  onOpenChange,
}: {
  shoes: SessionShoesView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pending, choose } = useChooseShoe(shoes.sessionKey);
  return (
    <PairSheet
      title="Quelle paire pour cette séance ?"
      context={shoes.context}
      note="Ton choix vaut pour cette séance. Stride en tient compte pour les prochaines."
      options={shoes.options}
      initialId={shoes.chosen?.id ?? null}
      pending={pending}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={(option) =>
        choose(option.id, option.name, () => onOpenChange(false))
      }
    />
  );
}

export function SessionShoesBlock({ shoes }: { shoes: SessionShoesView }) {
  const [picking, setPicking] = useState(false);
  const { pending, choose } = useChooseShoe(shoes.sessionKey);
  const alternatives = shoes.options.filter(
    (item) => item.id !== shoes.chosen?.id,
  );
  return (
    <section
      aria-labelledby="panel-shoes"
      className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface-panel p-3.5"
    >
      <div className="flex items-center gap-2">
        <MonoLabel size="nano" className="text-[9.5px]" id="panel-shoes">
          Chaussures
        </MonoLabel>
        <Link
          href="/gear"
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Matériel ›
        </Link>
      </div>
      {shoes.chosen && (
        <Link
          href={`/gear/${shoes.chosen.id}`}
          className="flex items-center gap-3 text-foreground"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border-strong bg-surface-raised">
            <NavGearIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {shoes.chosen.fullName}
            </span>
            <span className="text-xs text-muted-foreground">
              {shoes.chosen.km}
            </span>
          </span>
          <Badge label={shoes.chosen.badge} />
        </Link>
      )}
      <p className="text-[13px] leading-normal text-muted">{shoes.sentence}</p>
      {!shoes.hasPairs ? (
        <Button
          asChild
          variant="outline"
          size="md"
          className="self-start max-sm:h-11 max-sm:w-full"
        >
          <Link href="/gear/new">Ajouter une paire</Link>
        </Button>
      ) : (
        <>
          {alternatives.length > 0 && (
            <ul className="flex flex-col border-t border-border max-md:hidden">
              {alternatives.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border-subtle py-2.5 last:border-b-0"
                >
                  <span className="text-[13px] font-medium">{item.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="row-span-2 h-8"
                    disabled={pending}
                    aria-label={`Choisir ${theModel(item.name)}`}
                    onClick={() => choose(item.id, item.name)}
                  >
                    Choisir
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {item.sentence}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            className="h-11 md:hidden"
            onClick={() => setPicking(true)}
          >
            Changer de paire
          </Button>
          {picking && (
            <ShoePicker
              shoes={shoes}
              open={picking}
              onOpenChange={setPicking}
            />
          )}
        </>
      )}
    </section>
  );
}

export function TodayShoeChip({
  shoes,
  href,
}: {
  shoes: SessionShoesView;
  href: string;
}) {
  if (!shoes.chosen) return null;
  return (
    <Link
      href={href}
      aria-label={`Paire ${shoes.chosen.badge === "Ton choix" ? "choisie" : "conseillée"} : ${shoes.chosen.name}`}
      className="inline-flex min-h-8 items-center gap-1.75 rounded-full border border-border-strong pr-2.75 pl-2.25 text-[13px] whitespace-nowrap text-foreground hover:border-muted-foreground max-md:hidden"
    >
      <NavGearIcon className="size-3.5 text-muted-foreground" />
      {shoes.chosen.name}
    </Link>
  );
}

export function TodayShoeRow({ shoes }: { shoes: SessionShoesView }) {
  const [picking, setPicking] = useState(false);
  if (!shoes.chosen) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label={`Changer de paire, actuellement ${shoes.chosen.name}`}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-[10px] border border-border px-3 py-1.5 text-left text-[13px] text-foreground md:hidden"
      >
        <NavGearIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span>{shoes.chosen.name}</span>
          {shoes.chip && (
            <span className="truncate text-[11.5px] text-muted-foreground">
              {shoes.chip}
            </span>
          )}
        </span>
        <span className="flex items-center text-xs text-muted-foreground">
          Changer
          <ChevronRightIcon aria-hidden="true" className="size-3" />
        </span>
      </button>
      {picking && (
        <ShoePicker shoes={shoes} open={picking} onOpenChange={setPicking} />
      )}
    </>
  );
}
