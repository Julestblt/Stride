import { CheckIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import { SheetTitle } from "@/components/ui/sheet";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { zoneHeights } from "@/components/stride/session-blocks";
import { SessionKindTile } from "@/components/stride/session-kind-tile";
import { zoneFills } from "@/components/stride/session-shape";
import { cn } from "@/lib/utils";
import {
  panelStatusLabel,
  type PanelCompletion,
  type PanelStatus,
  type PanelTone,
  type SessionPanel,
} from "@/features/plans/view/session-panel";

const toneDots: Record<PanelTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
};

function Dk({ children, ...props }: React.ComponentProps<typeof MonoLabel>) {
  return (
    <MonoLabel size="nano" className="text-[9.5px]" {...props}>
      {children}
    </MonoLabel>
  );
}

function Status({ status }: { status: Exclude<PanelStatus, null> }) {
  const label = panelStatusLabel(status);
  if (status === "today")
    return (
      <span className="flex items-center gap-1.5 text-xs text-accent">
        <PulseDot breathing={false} />
        {label}
      </span>
    );
  if (status === "done" || status === "partial")
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          status === "done" ? "text-success" : "text-warning",
        )}
      >
        <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
        {label}
      </span>
    );
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

function Hero({ panel, titleId }: { panel: SessionPanel; titleId: string }) {
  return (
    <div className="flex items-start gap-3 sm:gap-3.5">
      <SessionKindTile
        kind={panel.family}
        size="xl"
        className="max-sm:size-10 max-sm:rounded-[10px]"
      />
      <div className="flex min-w-0 flex-col gap-1 sm:gap-1.25">
        {panel.status && <Status status={panel.status} />}
        <SheetTitle
          id={titleId}
          className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em]"
        >
          {panel.title}
        </SheetTitle>
        <p className="text-sm leading-normal text-muted max-sm:hidden">
          {panel.purpose}
        </p>
      </div>
    </div>
  );
}

function Proposal({
  proposal,
}: {
  proposal: NonNullable<SessionPanel["proposal"]>;
}) {
  return (
    <section
      aria-label="Changement proposé"
      className="flex flex-col gap-2.5 rounded-card border border-warning-border bg-warning/4 p-3.5"
    >
      <span className="flex items-center gap-2 text-[13px] text-warning">
        <PulseDot tone="warning" breathing={false} />
        Changement proposé {proposal.when}
      </span>
      <p className="text-sm leading-normal">{proposal.text}</p>
    </section>
  );
}

function Stats({ panel }: { panel: SessionPanel }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-3.5">
      {panel.stats.map((stat) => (
        <div key={stat.key} className="flex min-w-0 flex-col gap-0.75">
          <dt className="order-2">
            <Dk>{stat.label}</Dk>
          </dt>
          <dd className="order-1 truncate font-metric text-[22px] leading-none font-semibold tabular-nums sm:text-2xl">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Structure({ panel }: { panel: SessionPanel }) {
  return (
    <section
      aria-labelledby="panel-structure"
      className="flex flex-col gap-1.5"
    >
      <Dk id="panel-structure">Structure</Dk>
      <div
        role="img"
        aria-label={panel.structureLabel}
        className="flex gap-0.5"
      >
        {panel.segments.map((segment, index) => (
          <div
            key={index}
            className="flex min-w-0.5 flex-col items-stretch gap-1.5"
            style={{ flexGrow: segment.seconds, flexBasis: 0 }}
          >
            <span className="flex h-11 items-end">
              <span
                className={cn("w-full rounded-[2px]", zoneFills[segment.zone])}
                style={{ height: `${zoneHeights[segment.zone]}%` }}
              />
            </span>
            <span
              aria-hidden="true"
              className="h-3 text-center font-metric text-[11px] leading-none font-semibold text-muted-foreground"
            >
              {segment.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps({ panel }: { panel: SessionPanel }) {
  return (
    <section aria-labelledby="panel-steps" className="flex flex-col">
      <Dk id="panel-steps" className="pb-1 text-[9.5px]">
        Étapes
      </Dk>
      <ol>
        {panel.steps.map((step) => (
          <li
            key={step.key}
            className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-start gap-3 border-t border-border py-2.75"
          >
            <span
              aria-hidden="true"
              className={cn(
                "self-stretch rounded-[2px]",
                step.zone === 1 ? "bg-dim" : zoneFills[step.zone],
              )}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{step.name}</span>
              {step.cue && (
                <span className="text-[12.5px] leading-[1.45] text-muted-foreground">
                  {step.cue}
                </span>
              )}
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-metric text-[17px] leading-[1.1] font-semibold tabular-nums">
                {step.duration}
              </span>
              <span className="text-[11.5px] whitespace-nowrap text-muted">
                {step.target}
                {step.pace && (
                  <>
                    {" · "}
                    <span className="text-muted-foreground">{step.pace}</span>
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Contingencies({ items }: { items: string[] }) {
  return (
    <section
      aria-labelledby="panel-contingencies"
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-panel px-3.5 py-3"
    >
      <Dk id="panel-contingencies">Si ça se passe mal</Dk>
      <p className="text-[13px] leading-normal text-muted">{items.join(" ")}</p>
    </section>
  );
}

function Completion({ completion }: { completion: PanelCompletion }) {
  const maximum = Math.max(...completion.pace);
  const minimum = Math.min(...completion.pace);
  return (
    <>
      <div className="flex items-center gap-3 rounded-card border border-success-border bg-success-surface p-3.5">
        <CheckIcon
          aria-hidden="true"
          className="size-4.5 shrink-0 text-success"
          strokeWidth={2.5}
        />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {completion.headline}
          </span>
          <span className="text-xs text-muted-foreground">
            {completion.detail}
          </span>
        </span>
        {completion.pct !== null && (
          <span
            aria-hidden="true"
            className="font-metric text-[30px] leading-none font-semibold text-success tabular-nums"
          >
            {completion.pct}
          </span>
        )}
      </div>
      {completion.rows.length > 0 && (
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="pb-1.5">
                <span className="sr-only">Mesure</span>
              </th>
              <th
                scope="col"
                className="w-22.5 pb-1.5 pl-2.5 text-left font-normal"
              >
                <Dk>Prévu</Dk>
              </th>
              <th
                scope="col"
                className="w-22.5 pb-1.5 pl-2.5 text-left font-normal"
              >
                <Dk>Réalisé</Dk>
              </th>
              <th scope="col" className="w-6 pb-1.5">
                <span className="sr-only">Écart</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {completion.rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th
                  scope="row"
                  className="py-2.5 text-left font-normal text-muted"
                >
                  {row.label}
                </th>
                <td className="py-2.5 pl-2.5 font-metric text-base font-semibold text-muted-foreground tabular-nums">
                  {row.planned}
                </td>
                <td className="py-2.5 pl-2.5 font-metric text-base font-semibold tabular-nums">
                  {row.actual}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      toneDots[row.tone],
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {completion.paceLabel && (
        <section aria-labelledby="panel-pace" className="flex flex-col gap-1.5">
          <Dk id="panel-pace">Allure, minute par minute</Dk>
          <div
            role="img"
            aria-label={completion.paceLabel}
            className="flex h-7.5 items-end gap-[1.6px]"
          >
            {completion.pace.map((secondsPerKm, index) => (
              <span
                key={index}
                className="min-w-0 flex-1 rounded-[1px] bg-provider/85"
                style={{
                  height: `${
                    maximum === minimum
                      ? 50
                      : 40 +
                        ((maximum - secondsPerKm) / (maximum - minimum)) * 60
                  }%`,
                }}
              />
            ))}
          </div>
        </section>
      )}
      <Button
        asChild
        variant="outline"
        size="md"
        className="min-h-9.5 self-start rounded-control text-[13px]"
      >
        <Link href={`/activities/${completion.activityId}`}>
          Voir l’activité Garmin
        </Link>
      </Button>
    </>
  );
}

export function SessionPanelBody({
  panel,
  titleId,
}: {
  panel: SessionPanel;
  titleId: string;
}) {
  return (
    <div className="flex flex-col gap-4.5 sm:gap-5">
      <Hero panel={panel} titleId={titleId} />
      {panel.completion ? (
        <Completion completion={panel.completion} />
      ) : (
        <>
          {panel.proposal && <Proposal proposal={panel.proposal} />}
          <Stats panel={panel} />
          {panel.segments.length > 0 && <Structure panel={panel} />}
          {panel.steps.length > 0 && <Steps panel={panel} />}
          {panel.contingencies.length > 0 && (
            <Contingencies items={panel.contingencies} />
          )}
        </>
      )}
    </div>
  );
}
