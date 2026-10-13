import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";

const segment =
  "inline-flex min-h-11 items-center rounded-control border border-border-strong bg-surface-raised px-3 text-sm text-muted md:min-h-9.5 md:bg-surface";
const segmentSelected =
  "border-foreground bg-foreground font-semibold text-background";

export function PreferenceSection({
  title,
  accent = false,
  badge,
  id,
  children,
}: {
  title: string;
  accent?: boolean;
  badge?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-2 md:gap-0">
      <div className="flex items-center justify-between gap-2.5 px-1.5 md:border-b md:border-border-strong md:px-0 md:pb-2.5">
        <div className="flex items-center gap-2 md:gap-2.5">
          {accent && <StrideMark className="size-3" />}
          <h2 className="font-mono text-micro tracking-wider text-muted uppercase md:text-label">
            {title}
          </h2>
        </div>
        {badge && (
          <span className="rounded-tag border border-border-strong px-1.5 py-0.5 font-mono text-nano tracking-wider text-muted uppercase">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-col overflow-hidden rounded-surface border border-border bg-surface md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
        {children}
      </div>
    </section>
  );
}

export function PreferenceRow({
  labelId,
  label,
  hint,
  children,
}: {
  labelId: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid md:grid-cols-[13.75rem_minmax(0,1fr)] md:items-center md:gap-x-6 md:gap-y-2.5 md:px-0 md:py-4">
      <div className="flex flex-col gap-0.5">
        <span id={labelId} className="text-body md:text-sm">
          {label}
        </span>
        {hint && (
          <span className="text-xs leading-snug text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function SegmentedField({
  name,
  type = "radio",
  options,
  selected,
  labelledBy,
  stretch = false,
}: {
  name: string;
  type?: "radio" | "checkbox";
  options: { value: string; label: string }[];
  selected: string[];
  labelledBy: string;
  stretch?: boolean;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn("cursor-pointer", stretch && "max-md:flex-1")}
        >
          <input
            className="peer sr-only"
            type={type}
            name={name}
            value={option.value}
            defaultChecked={selected.includes(option.value)}
          />
          <span
            className={cn(
              segment,
              stretch && "max-md:w-full max-md:justify-center",
              "peer-checked:border-foreground peer-checked:bg-foreground peer-checked:font-semibold peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function WeekdayField({
  name,
  days,
  selected,
  labelledBy,
}: {
  name: string;
  days: { value: number; short: string; label: string }[];
  selected: number[];
  labelledBy: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex justify-between gap-1.5 md:justify-start"
    >
      {days.map((day) => (
        <label key={day.value} className="cursor-pointer">
          <input
            className="peer sr-only"
            type="checkbox"
            name={name}
            value={day.value}
            aria-label={day.label}
            defaultChecked={selected.includes(day.value)}
          />
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-full border border-border-strong bg-surface-raised text-xs font-semibold text-muted-foreground peer-checked:border-accent peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring md:size-10 md:bg-surface"
          >
            {day.short}
          </span>
        </label>
      ))}
    </div>
  );
}

export function PreviewSegments({
  labelledBy,
  options,
  selected,
  stretch = false,
}: {
  labelledBy: string;
  options: string[];
  selected?: string;
  stretch?: boolean;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled
          aria-pressed={option === selected}
          className={cn(
            segment,
            "disabled:cursor-not-allowed",
            option === selected ? segmentSelected : "opacity-70",
            stretch && "max-md:flex-1 max-md:justify-center",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function PreviewSwitch({ label }: { label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked="false"
      aria-label={label}
      disabled
      className="relative h-6 w-10 shrink-0 cursor-not-allowed rounded-full bg-border-strong after:absolute after:top-0.75 after:left-0.75 after:size-4.5 after:rounded-full after:bg-muted"
    />
  );
}

export function PreviewNotificationRow({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-border px-4 py-2.5 last:border-b-0 md:px-0 md:py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        <span className="text-xs leading-snug text-muted-foreground">
          {hint}
        </span>
      </div>
      <PreviewSwitch label={label} />
    </div>
  );
}
