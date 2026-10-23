import Link from "next/link";
import { MonoLabel } from "@/components/stride/mono-label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { missingItems, type MissingItem } from "../route-state";
import { AppHeader } from "./app-header";

const contours = [
  "M0 150C70 120 120 140 190 110S330 60 520 80",
  "M0 170C70 140 120 160 190 130S330 80 520 100",
  "M0 130C70 100 120 120 190 90S330 40 520 60",
  "M0 190C70 160 120 180 190 150S330 100 520 120",
];

function BrokenTrail() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 200"
      className="-mx-6 h-auto w-[calc(100%+3rem)] fill-none md:mx-0 md:w-full"
    >
      <g className="stroke-surface-raised" strokeWidth="1.1">
        {contours.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
      <path
        d="M0 196C50 170 100 160 150 150S220 120 250 100"
        className="stroke-accent"
        strokeWidth="2"
      />
      <path
        d="M250 100S300 72 340 60 440 36 520 30"
        className="stroke-border-strong"
        strokeDasharray="4 6"
        strokeWidth="2"
      />
      <circle
        cx="250"
        cy="100"
        r="11"
        className="stroke-accent opacity-50"
        strokeWidth="1.5"
      />
      <circle cx="250" cy="100" r="4.5" className="fill-accent" />
    </svg>
  );
}

const actionsClass =
  "mt-auto flex flex-col gap-2.5 pt-6 md:mt-0 md:flex-row md:flex-wrap md:pt-0 [&>*]:max-md:w-full";

export function RouteStateFrame({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader title={section} />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="flex min-h-full flex-col px-6 pt-8 pb-6 md:items-center md:justify-center md:p-12">
          {children}
        </main>
      </div>
    </>
  );
}

export function RouteError({
  retry,
  className,
}: {
  retry: () => void;
  className?: string;
}) {
  return (
    <section
      role="alert"
      aria-labelledby="route-error-title"
      className={cn(
        "flex w-full max-w-130 flex-1 flex-col gap-5.5 md:flex-none",
        className,
      )}
    >
      <BrokenTrail />
      <div className="flex flex-col gap-3">
        <MonoLabel size="micro">Erreur de chargement</MonoLabel>
        <h1
          id="route-error-title"
          className="text-headline font-semibold tracking-tight"
        >
          Cette page n’a pas pu se charger.
        </h1>
        <p className="text-body text-muted">
          Un service n’a pas répondu à temps. Tes données sont en sécurité :
          réessaie, ou repars d’Aujourd’hui.
        </p>
      </div>
      <div className={actionsClass}>
        <Button type="button" onClick={retry}>
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/today">Retour à Aujourd’hui</Link>
        </Button>
      </div>
    </section>
  );
}

export function RouteNotFound({ item }: { item: MissingItem }) {
  const { title, message, action } = missingItems[item];
  return (
    <section
      aria-labelledby="route-not-found-title"
      className="flex w-full max-w-120 flex-1 flex-col gap-5.5 md:flex-none"
    >
      <div className="flex flex-col gap-1">
        <MonoLabel size="micro">Erreur 404</MonoLabel>
        <p
          aria-hidden="true"
          className="font-metric text-[5.5rem] leading-[0.9] font-bold tracking-[-0.02em] text-accent italic md:text-[6rem]"
        >
          404
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <h1
          id="route-not-found-title"
          className="text-headline font-semibold tracking-tight"
        >
          {title}
        </h1>
        <p className="text-body text-muted">{message}</p>
      </div>
      <div className={actionsClass}>
        {action && (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
        <Button asChild variant={action ? "outline" : "default"}>
          <Link href="/today">Retour à Aujourd’hui</Link>
        </Button>
      </div>
    </section>
  );
}
