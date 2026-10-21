import Link from "next/link";
import { MonoLabel } from "@/components/stride/mono-label";
import { NavGearIcon } from "@/components/stride/nav-icons";
import { cn } from "@/lib/utils";
import type { RotationView, WeekShoeRow } from "../planned";

function PairChip({ name, href }: { name: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.75 rounded-full border border-border-strong pr-2.75 pl-2.25 text-[13px] whitespace-nowrap text-foreground hover:border-muted-foreground"
    >
      <NavGearIcon className="size-3.5 text-muted-foreground" />
      {name}
    </Link>
  );
}

export function PlannedPairs({ rows }: { rows: WeekShoeRow[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface p-5 max-md:border-0 max-md:bg-transparent max-md:p-0">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="text-[17px] font-semibold">
          <span className="md:hidden">Cette semaine</span>
          <span className="max-md:hidden">Paires prévues cette semaine</span>
        </h2>
        <span className="text-xs text-muted-foreground max-md:hidden">
          choisies par Stride, modifiables sur chaque séance
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-border pt-3 text-sm text-muted">
          Plus de séance de course prévue cette semaine.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.sessionKey}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-0.5 border-t border-border py-3 md:grid-cols-[92px_minmax(0,1fr)_auto]"
            >
              <MonoLabel size="nano" className="text-[10px] max-md:hidden">
                {row.day}
              </MonoLabel>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{row.title}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="md:hidden">{row.day} · </span>
                  {row.detail}
                </span>
              </span>
              {row.pair ? (
                <PairChip name={row.pair} href={row.href} />
              ) : (
                <Link
                  href={row.href}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Aucune paire
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function dotSize(km: number) {
  return Math.round(Math.min(Math.max(8 + km / 2, 9), 20));
}

export function RotationStrip({ view }: { view: RotationView }) {
  if (view.rows.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface p-5 max-md:hidden">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold">
          Rotation · 14 derniers jours
        </h2>
        <span className="text-xs text-muted-foreground">{view.range}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-105 table-fixed border-collapse">
          <thead>
            <tr>
              <th scope="col" className="w-36 pb-2 text-left">
                <MonoLabel size="nano" className="text-[9.5px]">
                  Paire
                </MonoLabel>
              </th>
              {view.days.map((day) => (
                <th
                  key={day.day}
                  scope="col"
                  className="pb-2 text-center font-mono text-[9.5px] font-normal text-muted-foreground"
                >
                  <abbr title={day.label} className="no-underline">
                    {day.letter}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.id}>
                <th
                  scope="row"
                  className="truncate pr-4 text-left text-[13px] font-medium whitespace-nowrap"
                >
                  {row.name}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.day} className="h-8.5 text-center align-middle">
                    {cell.km !== null ? (
                      <span
                        title={cell.label ?? undefined}
                        className={cn(
                          "inline-block rounded-full align-middle",
                          cell.pending
                            ? "border-[1.5px] border-dashed border-warning"
                            : "bg-foreground",
                        )}
                        style={{
                          width: dotSize(cell.km),
                          height: dotSize(cell.km),
                        }}
                      >
                        <span className="sr-only">{cell.label}</span>
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-block size-1 rounded-full bg-border align-middle"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-foreground"
          />
          sortie · taille = km
        </span>
        {view.rows.some((row) => row.cells.some((cell) => cell.pending)) && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full border-[1.5px] border-dashed border-warning"
            />
            paire à confirmer
          </span>
        )}
      </div>
      <p className="text-[13px] leading-normal text-muted">
        Évite d’enchaîner deux jours la même paire : Stride en tient compte dans
        ses choix.
      </p>
    </section>
  );
}
