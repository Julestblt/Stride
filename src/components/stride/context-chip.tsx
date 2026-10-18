import { XIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";

type ChipContent = {
  icon: React.ReactNode;
  label: string;
  meta?: string | null;
  className?: string;
};

function Content({ icon, label, meta }: Omit<ChipContent, "className">) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex shrink-0 text-muted-foreground [&_svg]:size-3.25"
      >
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {meta && (
        <MonoLabel size="nano" className="shrink-0">
          {meta}
        </MonoLabel>
      )}
    </>
  );
}

export function ContextChip({
  icon,
  label,
  meta,
  removeLabel,
  onRemove,
  disabled = false,
  className,
}: ChipContent & {
  removeLabel: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      data-slot="context-chip"
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control border border-border-strong bg-surface-raised pl-2.5 text-meta text-foreground md:min-h-8 md:pr-0.5",
        className,
      )}
    >
      <Content icon={icon} label={label} meta={meta} />
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        disabled={disabled}
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors duration-150 ease-stride outline-none hover:bg-border hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:size-7"
      >
        <XIcon aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}

export function ContextChipLink({
  icon,
  label,
  meta,
  href,
  className,
}: ChipContent & { href: string }) {
  return (
    <Link
      href={href}
      data-slot="context-chip-link"
      className={cn(
        "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-control border border-border-strong px-2.5 text-xs text-muted transition-colors duration-150 ease-stride outline-none hover:border-dim hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-7",
        className,
      )}
    >
      <Content icon={icon} label={label} meta={meta} />
    </Link>
  );
}
