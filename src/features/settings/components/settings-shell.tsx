"use client";

import Link from "next/link";
import { ProvenanceLabel } from "@/components/stride/provenance";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { settingsHref, settingsSections } from "../navigation";

export function SettingsShell({
  athlete,
  children,
}: {
  athlete: { name: string; initials: string; detail: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const profile = pathname === "/settings/profile";
  const active = settingsSections.find(
    (section) => settingsHref(section.slug) === pathname,
  );
  return (
    <div className="min-h-svh bg-background text-foreground md:grid md:h-svh md:min-h-0 md:grid-cols-[16.5rem_minmax(0,1fr)] md:overflow-hidden">
      <aside className="hidden h-svh min-h-0 flex-col border-r border-border bg-background px-2 pt-4 pb-2 md:flex">
        <Link
          href="/activities"
          className="mb-8 flex items-center gap-2 rounded-control px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="grid size-9 place-items-center rounded-control border border-border-strong">
            <ArrowLeftIcon className="size-4" />
          </span>
          <span>
            <strong className="block">Réglages</strong>
            <span className="text-xs text-muted">Retour à Stride</span>
          </span>
        </Link>
        <div className="min-h-0 overflow-y-auto">
          {(["You", "Data"] as const).map((group) => (
            <div key={group} className="mb-4">
              <p className="mb-1 px-2 font-mono text-label tracking-wider text-muted uppercase">
                {group === "You" ? "Toi" : "Données"}
              </p>
              <nav
                aria-label={
                  group === "You"
                    ? "Réglages personnels"
                    : "Réglages des données"
                }
                className="flex flex-col gap-0.5"
              >
                {settingsSections
                  .filter((section) => section.group === group)
                  .map((section) => {
                    const href = settingsHref(section.slug);
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={pathname === href ? "page" : undefined}
                        className={cn(
                          "rounded-control px-2 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                          pathname === href &&
                            "bg-surface-raised font-medium text-foreground",
                        )}
                      >
                        {section.label}
                      </Link>
                    );
                  })}
              </nav>
            </div>
          ))}
        </div>
        <div data-slot="settings-account" className="mt-auto p-2">
          <div className="flex min-h-12 items-center gap-2.5 px-1.5 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-control bg-border text-xs font-semibold">
              {athlete.initials}
            </span>
            <span className="flex min-w-0 flex-col text-left">
              <strong className="truncate text-meta leading-tight font-semibold">
                {athlete.name}
              </strong>
              <span className="block truncate text-xs text-muted-foreground">
                {athlete.detail}
              </span>
            </span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 p-0 md:h-svh md:min-h-0 md:overflow-y-auto md:p-2">
        <div
          className={cn(
            "min-h-svh rounded-surface border-0 border-border bg-background md:min-h-[calc(100svh-1rem)] md:border",
            profile && "border-subtle rounded-panel bg-surface-inset",
          )}
        >
          <header className="flex min-h-14 items-center gap-3 border-b border-border px-5 max-md:border-0 md:px-6">
            <Link
              href={active?.slug ? "/settings" : "/activities"}
              aria-label={
                active?.slug ? "Retour aux réglages" : "Retour à Stride"
              }
              className="rounded-control p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:hidden"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
            {active?.slug ? (
              <span className="font-mono text-label tracking-wider text-muted uppercase md:font-sans md:text-sm md:tracking-normal md:normal-case">
                Réglages
                {profile ? <span className="md:hidden"> / Profil</span> : null}
              </span>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight md:text-sm md:font-normal md:tracking-normal md:text-muted">
                Réglages
              </h1>
            )}
            {active?.slug && (
              <>
                <span className="hidden text-muted md:inline">/</span>
                <span className="hidden text-sm md:inline">{active.label}</span>
              </>
            )}
            {profile && (
              <div className="ml-auto hidden gap-3.5 md:flex">
                <ProvenanceLabel source="provider">Garmin</ProvenanceLabel>
                <ProvenanceLabel source="manual">Toi</ProvenanceLabel>
                <ProvenanceLabel source="estimate">
                  Estimation Stride
                </ProvenanceLabel>
              </div>
            )}
          </header>
          <div
            data-slot="settings-content"
            className={cn(
              "mx-auto w-full max-w-[1440px] px-4 pt-4 pb-16 md:mx-0 md:px-12 md:pt-10 2xl:mx-auto",
              profile && "max-w-[1000px] md:pt-9 2xl:mx-0",
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function SettingsHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-9">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="mb-3 font-mono text-label tracking-wider text-muted uppercase">
        {title}
      </h2>
      <div className="overflow-hidden rounded-surface border border-border md:rounded-none md:border-x-0 md:border-b-0">
        {children}
      </div>
    </section>
  );
}

export function SettingsLinkRow({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-17 items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring md:px-0"
    >
      <strong className="min-w-0 flex-1 text-sm">{title}</strong>
      <span className="max-w-[55%] text-right text-sm text-muted">
        {detail}
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

export function UnavailableSettingRow({
  title,
  detail,
  value,
}: {
  title: string;
  detail: string;
  value?: string;
}) {
  return (
    <div className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-center md:px-0">
      <strong className="text-sm font-medium">{title}</strong>
      <p className="text-sm text-muted">{detail}</p>
      <span className="font-mono text-label text-muted uppercase">
        {value ?? "Indisponible"}
      </span>
    </div>
  );
}
