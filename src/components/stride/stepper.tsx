import { cn } from "@/lib/utils";
import { DoneMark } from "@/components/stride/marks";
import { describeProgress, type StepStatus } from "@/components/stride/steps";

const statusText: Record<StepStatus, string> = {
  done: "Done",
  background: "In progress",
  current: "Current step",
  upcoming: "Not started",
};

export function Stepper({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="stepper"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function StepMark({ status, index }: { status: StepStatus; index: number }) {
  if (status === "done") return <DoneMark />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-6.5 shrink-0 place-items-center rounded-full border-[1.5px] font-metric text-sm font-semibold",
        status === "background" && "border-dashed border-accent",
        status === "current" && "border-accent text-accent",
        status === "upcoming" && "border-border-strong text-muted-foreground",
      )}
    >
      {status === "background" ? (
        <span className="size-1.5 rounded-full bg-accent" />
      ) : (
        index
      )}
    </span>
  );
}

export function StepperItem({
  status,
  index,
  label,
  detail,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "children"> & {
  status: StepStatus;
  index: number;
  label: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <li
      data-slot="stepper-item"
      data-status={status}
      aria-current={status === "current" ? "step" : undefined}
      className={cn(
        "relative grid grid-cols-[1.625rem_minmax(0,1fr)] items-start gap-3 pb-4.5 before:absolute before:top-7 before:bottom-0.5 before:left-[0.78125rem] before:w-px before:bg-border last:pb-0 last:before:hidden",
        className,
      )}
      {...props}
    >
      <StepMark status={status} index={index} />
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.75">
        <span
          className={cn(
            "text-sm",
            status === "current"
              ? "font-semibold text-foreground"
              : "text-muted",
          )}
        >
          {label}
          <span className="sr-only">, {statusText[status]}</span>
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </span>
    </li>
  );
}

export function StepperSegments({
  statuses,
  currentProgress = 0,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  statuses: readonly StepStatus[];
  currentProgress?: number;
}) {
  const { position, total, label } = describeProgress(statuses);
  const fill = Math.min(Math.max(currentProgress, 0), 1) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={position}
      aria-valuetext={label}
      aria-label="Onboarding progress"
      data-slot="stepper-segments"
      className={cn("grid auto-cols-fr grid-flow-col gap-1", className)}
      {...props}
    >
      {statuses.map((status, index) => (
        <span
          key={index}
          data-status={status}
          className={cn(
            "relative h-0.75 overflow-hidden rounded-mark",
            status === "done" && "bg-success",
            status === "background" && "bg-dim",
            status === "current" && "bg-border",
            status === "upcoming" && "bg-border",
          )}
        >
          {status === "current" && (
            <span
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-320 ease-stride"
              style={{ width: `${fill}%` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
