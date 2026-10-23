"use client";

import { useParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { AddTabs } from "./add-tabs";
import { GearFrame } from "./gear-frame";

const pageTitle =
  "text-[clamp(30px,3.2vw,40px)] leading-none font-semibold tracking-[-0.03em]";

function useShoeId() {
  const { id } = useParams<{ id?: string }>();
  return typeof id === "string" ? id : null;
}

function ShoeBreadcrumb({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      <Link
        href="/gear"
        className="truncate text-muted-foreground hover:text-foreground"
      >
        Matériel
      </Link>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      <Skeleton aria-hidden="true" className="h-4 w-32" />
      {current && (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
          <span aria-current="page" className="truncate">
            {current}
          </span>
        </>
      )}
    </nav>
  );
}

function FormLoading({ create }: { create: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <Skeleton
        className={
          create
            ? "h-80 w-full rounded-panel sm:h-52"
            : "h-60 w-full rounded-panel sm:h-28"
        }
      />
      <Skeleton className="h-96 w-full rounded-panel sm:h-80" />
      {create && (
        <>
          <Skeleton className="h-60 w-full rounded-panel sm:h-44" />
          <Skeleton className="h-52 w-full rounded-panel sm:h-44" />
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Skeleton className="h-9.5 w-24 rounded-surface" />
        <Skeleton className="h-9.5 w-40 rounded-surface" />
      </div>
    </div>
  );
}

export function GearListLoading() {
  return (
    <GearFrame crumbs={[{ label: "Matériel" }]}>
      <LoadingScope
        label="Chargement du matériel"
        className="flex flex-col gap-7"
      >
        <section className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[clamp(32px,3.5vw,44px)] leading-none font-semibold tracking-[-0.03em]">
              Matériel
            </h1>
            <Skeleton aria-hidden="true" className="h-5 w-80 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="md">
              <Link href="/gear/new">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Ajouter une paire
              </Link>
            </Button>
          </div>
        </section>
        <div
          aria-hidden="true"
          className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-3.5"
        >
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-70 rounded-panel" />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-3.5"
        >
          <Skeleton className="h-64 rounded-panel" />
          <Skeleton className="h-64 rounded-panel max-md:hidden" />
        </div>
      </LoadingScope>
    </GearFrame>
  );
}

export function GearDetailLoading() {
  return (
    <GearFrame
      crumbs={[{ label: "Matériel", href: "/gear" }]}
      breadcrumb={<ShoeBreadcrumb />}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <LoadingScope
        label="Chargement de la paire"
        className="flex flex-col gap-7"
      >
        <section
          aria-hidden="true"
          className="flex flex-wrap items-end justify-between gap-5"
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-tag" />
              <Skeleton className="h-5 w-14 rounded-tag" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-10 w-64 max-w-full" />
            </div>
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9.5 w-36 rounded-surface" />
            <Skeleton className="h-9.5 w-32 rounded-surface" />
          </div>
        </section>
        <Skeleton
          aria-hidden="true"
          className="h-140 w-full rounded-panel sm:h-100"
        />
        <div
          aria-hidden="true"
          className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2"
        >
          <Skeleton className="h-80 rounded-panel" />
          <Skeleton className="h-80 rounded-panel" />
        </div>
      </LoadingScope>
    </GearFrame>
  );
}

export function GearEditLoading() {
  const id = useShoeId();
  return (
    <GearFrame
      crumbs={[{ label: "Matériel", href: "/gear" }]}
      breadcrumb={<ShoeBreadcrumb current="Modifier" />}
      back={{
        href: id ? `/gear/${id}` : "/gear",
        label: id ? "Retour à la paire" : "Retour au matériel",
      }}
    >
      <LoadingScope
        label="Chargement de la fiche"
        className="flex flex-col gap-7"
      >
        <h1 className={pageTitle}>Modifier la fiche</h1>
        <FormLoading create={false} />
      </LoadingScope>
    </GearFrame>
  );
}

export function GearNewLoading() {
  return (
    <GearFrame
      crumbs={[
        { label: "Matériel", href: "/gear" },
        { label: "Ajouter une paire" },
      ]}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <LoadingScope
        label="Chargement du formulaire"
        className="flex flex-col gap-7"
      >
        <section className="flex flex-col gap-2.5">
          <h1 className={pageTitle}>Ajouter une paire</h1>
          <p className="max-w-155 text-sm text-muted">
            Donne le nom de la paire : Stride propose son type, son terrain et
            une phrase pour la décrire. Tu corriges si besoin.
          </p>
        </section>
        <AddTabs current="name" />
        <FormLoading create />
      </LoadingScope>
    </GearFrame>
  );
}

export function GearImportLoading() {
  return (
    <GearFrame
      crumbs={[
        { label: "Matériel", href: "/gear" },
        { label: "Importer depuis Garmin" },
      ]}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <LoadingScope
        label="Chargement des paires Garmin"
        className="flex flex-col gap-7"
      >
        <section className="flex flex-col gap-2.5">
          <h1 className={pageTitle}>Importer depuis Garmin</h1>
          <p className="max-w-160 text-sm text-muted">
            Vérifie les kilomètres de chaque paire : si elle a couru avant
            d’être dans Garmin, saisis son vrai total.
          </p>
        </section>
        <AddTabs current="garmin" />
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
          {[0, 1, 2, 3].map((row) => (
            <div
              aria-hidden="true"
              key={row}
              className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3.5 border-t border-border py-3.5 sm:grid-cols-[28px_minmax(0,1fr)_120px_170px]"
            >
              <Skeleton className="size-5 rounded-tag" />
              <div className="flex min-w-0 flex-col gap-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-9 w-56 max-w-full rounded-control" />
              </div>
              <Skeleton className="col-start-2 h-5 w-20 sm:col-start-auto sm:justify-self-end" />
              <Skeleton className="col-start-2 h-9 w-32 rounded-control sm:col-start-auto sm:justify-self-end" />
            </div>
          ))}
        </section>
      </LoadingScope>
    </GearFrame>
  );
}
