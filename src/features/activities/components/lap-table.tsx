import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import type { LapTable } from "@/features/activities/detail";

function Missing() {
  return (
    <>
      <span aria-hidden="true" className="text-dim">
        —
      </span>
      <span className="sr-only">non disponible</span>
    </>
  );
}

export function LapTableSection({ table }: { table: LapTable }) {
  return (
    <section aria-labelledby="activity-laps" className="flex flex-col gap-4">
      <h2 id="activity-laps" className="text-title font-semibold">
        {table.title}
      </h2>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{table.title}</caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="py-2 pr-3 font-normal">
              <MonoLabel size="nano">
                {table.title === "Tours" ? "Tour" : "Segment"}
              </MonoLabel>
            </th>
            {table.columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "py-2 pl-3 text-right font-normal",
                  !column.compact && "hidden sm:table-cell",
                )}
              >
                <MonoLabel size="nano">{column.label}</MonoLabel>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key} className="border-b border-border-subtle">
              <th
                scope="row"
                className="py-3 pr-3 text-sm font-medium text-foreground"
              >
                {row.label}
              </th>
              {table.columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "py-3 pl-3 text-right font-metric text-lead font-semibold tracking-[-0.01em] text-foreground tabular-nums",
                    !column.compact && "hidden sm:table-cell",
                  )}
                >
                  {row.cells[column.key] ?? <Missing />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
