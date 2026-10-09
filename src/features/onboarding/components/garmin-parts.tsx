import { CheckIcon, CircleAlertIcon, LockIcon } from "lucide-react";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";

type StageStatus = "done" | "current" | "upcoming";

export function ConnectStages({
  statuses,
  optionalVerification = false,
}: {
  statuses: [StageStatus, StageStatus, StageStatus];
  optionalVerification?: boolean;
}) {
  const labels = [
    "Connexion",
    <>
      Vérification
      {optionalVerification && (
        <span className="hidden lg:inline"> si besoin</span>
      )}
    </>,
    "Connecté",
  ];
  return (
    <ol
      aria-label="Progression de la connexion Garmin"
      className="flex flex-wrap items-center gap-2 font-mono text-micro uppercase"
    >
      {labels.map((label, index) => {
        const status = statuses[index];
        return (
          <li
            key={index}
            aria-current={status === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5",
              status === "done" && "text-success",
              status === "current" && "font-medium text-accent",
              status === "upcoming" && "text-muted-foreground",
            )}
          >
            {index > 0 && (
              <span aria-hidden="true" className="mr-1 h-px w-4 bg-border" />
            )}
            {status === "done" ? (
              <CheckIcon aria-hidden="true" className="size-2.5" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  status === "current"
                    ? "bg-accent"
                    : "border border-muted-foreground",
                )}
              />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function GarminNoticeBox({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 rounded-surface border border-warning-border bg-surface px-4.5 py-4"
    >
      <CircleAlertIcon
        aria-hidden="true"
        className="mt-0.5 size-4 text-warning"
      />
      <p className="text-body font-semibold">{title}</p>
      {children && (
        <div className="col-start-2 text-meta text-muted">{children}</div>
      )}
    </div>
  );
}

export function SecureNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5 text-meta text-muted">
      <LockIcon aria-hidden="true" className="mt-0.75 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function ReadOnlyNote() {
  return (
    <p className="flex items-center gap-2.5 text-meta text-muted-foreground">
      <PulseDot tone="provider" breathing={false} />
      Lecture seule. Stride ne publie jamais sur Garmin.
    </p>
  );
}

export function AsideList({
  title,
  items,
  numbered = false,
}: {
  title: string;
  items: { title?: string; body: string }[];
  numbered?: boolean;
}) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h2 className="border-b border-border pb-3 font-mono text-label text-muted-foreground uppercase">
        {title}
      </h2>
      <ol>
        {items.map((item, index) => (
          <li
            key={item.title ?? item.body}
            className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-border py-3.5"
          >
            {numbered ? (
              <span className="font-metric text-sm font-semibold text-muted">
                {index + 1}
              </span>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="flex flex-col gap-1">
              {item.title && (
                <span className="text-sm font-semibold">{item.title}</span>
              )}
              <span className="text-meta text-muted">{item.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StepLayout({
  aside,
  centered = false,
  children,
}: {
  aside?: React.ReactNode;
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,32.5rem)_minmax(0,26.5rem)] lg:items-start lg:gap-16",
        centered && "lg:content-center",
      )}
    >
      <div className="flex flex-1 flex-col gap-6 motion-safe:animate-rise lg:flex-none">
        {children}
      </div>
      {aside && (
        <aside className="hidden flex-col gap-6 lg:mt-11 lg:flex">
          {aside}
        </aside>
      )}
    </div>
  );
}

export function StepHeading({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[2rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
        {title}
      </h1>
      {children && (
        <p className="text-body text-pretty text-muted lg:text-lead">
          {children}
        </p>
      )}
    </div>
  );
}
