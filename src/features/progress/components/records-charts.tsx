import { ChartInspector } from "@/components/stride/chart-inspector";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatClock, formatRecordDate, formatMonthYear } from "../format";
import type { RecordPoint } from "../record-history";
import { formatEndurance, type RecordsView } from "../records-view";
import { enduranceDefinitions } from "../record-history";

export function RoadHistoryChart({
  points,
  label,
}: {
  points: RecordPoint[];
  label: string;
}) {
  const values = points.map((p) => p.value),
    min = Math.min(...values),
    span = Math.max(...values) - min || 1;
  const coordinates = points.map((p, i) => ({
    x: 20 + (i / Math.max(1, points.length - 1)) * 560,
    y: 25 + ((p.value - min) / span) * 65,
  }));
  return (
    <ChartInspector
      label={`Historique du record ${label}`}
      points={points.map((p, i) => ({
        x: coordinates[i].x / 600,
        title: formatRecordDate(p.day),
        rows: [{ label, value: formatClock(p.value) }],
        note: `${p.name} · estimation Stride à partir de Garmin`,
      }))}
    >
      {[360, 600].map((width) => (
        <svg
          key={width}
          viewBox={`0 0 ${width} 125`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Évolution du record ${label}`}
          className={
            width === 360
              ? "h-32 w-full sm:hidden"
              : "hidden h-32 w-full sm:block"
          }
        >
          <polyline
            points={coordinates
              .map((p) => `${(p.x / 600) * width},${p.y}`)
              .join(" ")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
          />
          {coordinates.map((p, i) => (
            <g key={`${points[i].day}-${i}`}>
              <circle
                cx={(p.x / 600) * width}
                cy={p.y}
                r="4"
                fill={
                  i === points.length - 1 ? "var(--accent)" : "var(--surface)"
                }
                stroke="var(--muted-foreground)"
              />
              {(i === 0 ||
                i === points.length - 1 ||
                i % Math.max(1, Math.ceil((points.length - 1) / 3)) === 0) && (
                <>
                  <text
                    x={(p.x / 600) * width}
                    y={p.y - 9}
                    textAnchor={
                      i === 0
                        ? "start"
                        : i === points.length - 1
                          ? "end"
                          : "middle"
                    }
                    fill="var(--foreground)"
                    fontSize="13"
                  >
                    {formatClock(points[i].value)}
                  </text>
                  <text
                    x={(p.x / 600) * width}
                    y="118"
                    textAnchor={
                      i === 0
                        ? "start"
                        : i === points.length - 1
                          ? "end"
                          : "middle"
                    }
                    fill="var(--muted-foreground)"
                    fontSize={width === 360 ? 9 : 10}
                  >
                    {formatMonthYear(points[i].day)}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      ))}
    </ChartInspector>
  );
}

export function RecordsChronology({ view }: { view: RecordsView }) {
  const events = view.events;
  const first = Date.parse(`${events[0]?.day ?? "2000-01-01"}T00:00:00Z`),
    last = Date.parse(`${events.at(-1)?.day ?? "2000-01-01"}T00:00:00Z`),
    span = last - first || 1;
  const formatted = (p: (typeof events)[number]) => {
    if (p.kind === "road") return formatClock(p.value);
    const definition = enduranceDefinitions.find((d) => d.key === p.key)!;
    return `${formatEndurance({ ...definition, history: [], current: null }, p.value)}${definition.key === "duration" ? "" : ` ${definition.unit}`}`;
  };
  const byDay = new Map<string, typeof events>();
  for (const event of events)
    byDay.set(event.day, [...(byDay.get(event.day) ?? []), event]);
  return (
    <section
      aria-labelledby="records-chronology"
      className="min-w-0 rounded-panel border border-border bg-surface p-4 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="records-chronology">
          <MonoLabel size="micro">Quand tes records sont tombés</MonoLabel>
        </h2>
        <span className="text-xs text-muted-foreground">
          ○ Vitesse · ◉ Endurance · ● Record actuel
        </span>
      </div>
      {events.length ? (
        <ChartInspector
          label="Chronologie des records"
          points={[...byDay.entries()].map(([day, records]) => ({
            x: 0.17 + ((Date.parse(`${day}T00:00:00Z`) - first) / span) * 0.73,
            title: formatRecordDate(day),
            rows: records.map((p) => ({
              label: `${p.label} · ${p.name}`,
              value: formatted(p),
              tone:
                p.kind === "road"
                  ? ("foreground" as const)
                  : ("accent" as const),
            })),
            note: `${[...new Set(records.map((p) => p.name))].join(" · ")} · Garmin, calcul Stride`,
          }))}
        >
          {[360, 800].map((width) => {
            const mobile = width === 360;
            const x = (day: string) =>
              (0.17 +
                ((Date.parse(`${day}T00:00:00Z`) - first) / span) * 0.73) *
              width;
            const clusters: (typeof events)[] = [];
            for (const kind of ["road", "endurance"] as const) {
              const lane = events.filter((p) => p.kind === kind);
              let cluster: typeof events = [];
              for (const point of lane) {
                if (
                  cluster.length &&
                  x(point.day) - x(cluster[0].day) > (mobile ? 110 : 130)
                ) {
                  clusters.push(cluster);
                  cluster = [];
                }
                cluster.push(point);
              }
              if (cluster.length) clusters.push(cluster);
            }
            return (
              <svg
                key={width}
                viewBox={`0 0 ${width} 130`}
                preserveAspectRatio="none"
                className={
                  mobile
                    ? "h-32 w-full sm:hidden"
                    : "hidden h-32 w-full sm:block"
                }
                role="img"
                aria-label="Dates des records de vitesse et d’endurance"
              >
                <text
                  x="0"
                  y="42"
                  fill="var(--muted-foreground)"
                  fontSize={mobile ? 8 : 10}
                >
                  VITESSE
                </text>
                <text
                  x="0"
                  y="92"
                  fill="var(--muted-foreground)"
                  fontSize={mobile ? 8 : 10}
                >
                  ENDURANCE
                </text>
                <path
                  d={`M${width * 0.17} 40H${width * 0.94}M${width * 0.17} 90H${width * 0.94}`}
                  stroke="var(--border)"
                  strokeDasharray="2 3"
                />
                {events.map((point, i) => (
                  <circle
                    key={`${point.key}-${i}`}
                    cx={x(point.day)}
                    cy={point.kind === "road" ? 40 : 90}
                    r={point.current ? 4 : 3}
                    fill={
                      point.current
                        ? point.kind === "road"
                          ? "var(--foreground)"
                          : "var(--accent)"
                        : "var(--surface)"
                    }
                    stroke={
                      point.kind === "road"
                        ? "var(--muted-foreground)"
                        : "var(--accent)"
                    }
                  />
                ))}
                {clusters.map((cluster, i) => {
                  if (
                    mobile &&
                    clusters.some(
                      (other, index) =>
                        index > i && other[0].kind === cluster[0].kind,
                    )
                  )
                    return null;
                  const priority = [
                    "10k",
                    "half",
                    "distance",
                    "duration",
                    "vam",
                  ];
                  const current = cluster.filter((p) => p.current);
                  const point = [...(current.length ? current : cluster)].sort(
                    (a, b) =>
                      (priority.indexOf(a.key) < 0
                        ? 99
                        : priority.indexOf(a.key)) -
                        (priority.indexOf(b.key) < 0
                          ? 99
                          : priority.indexOf(b.key)) ||
                      b.day.localeCompare(a.day),
                  )[0];
                  const position = x(point.day);
                  return (
                    <text
                      key={i}
                      x={position}
                      y={point.kind === "road" ? 28 : 78}
                      textAnchor={
                        position > width * 0.75
                          ? "end"
                          : position < width * 0.25
                            ? "start"
                            : "middle"
                      }
                      fill={
                        point.current
                          ? "var(--foreground)"
                          : "var(--muted-foreground)"
                      }
                      fontSize={mobile ? 9 : 10}
                    >
                      {mobile
                        ? `${point.kind === "road" ? `${point.label} · ` : ""}${formatted(point)}`
                        : `${point.label} · ${formatted(point)}${cluster.length > 1 ? ` +${cluster.length - 1}` : ""}`}
                    </text>
                  );
                })}
                <text
                  x={width * 0.17}
                  y="125"
                  fill="var(--muted-foreground)"
                  fontSize={mobile ? 8 : 10}
                >
                  {formatMonthYear(events[0].day)}
                </text>
                <text
                  x={width * 0.9}
                  y="125"
                  textAnchor="end"
                  fill="var(--muted-foreground)"
                  fontSize={mobile ? 8 : 10}
                >
                  {formatMonthYear(events.at(-1)!.day)}
                </text>
              </svg>
            );
          })}
        </ChartInspector>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun record documenté pour ce filtre.
        </p>
      )}
    </section>
  );
}
