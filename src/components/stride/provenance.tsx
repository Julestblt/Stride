import { cn } from "@/lib/utils";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { SourceMark, type Source } from "@/components/stride/marks";

export function ProvenanceLabel({
  source,
  variant = "inline",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  source: Source;
  variant?: "inline" | "mono";
}) {
  if (variant === "mono") {
    return (
      <MonoLabel
        size="micro"
        data-slot="provenance"
        data-source={source}
        className={className}
        {...props}
      >
        {children}
      </MonoLabel>
    );
  }
  return (
    <span
      data-slot="provenance"
      data-source={source}
      className={cn(
        "inline-flex items-center gap-1.75 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      <SourceMark source={source} />
      <span>{children}</span>
    </span>
  );
}

export function SignalList({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="signal-list"
      className={cn("flex flex-col border-t border-border", className)}
      {...props}
    />
  );
}

export function SignalRow({
  label,
  value,
  unit,
  source,
  provenance,
  provenanceVariant = "inline",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  source: Source;
  provenance: React.ReactNode;
  provenanceVariant?: "inline" | "mono";
}) {
  return (
    <div
      data-slot="signal-row"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border py-2.75",
        className,
      )}
      {...props}
    >
      <dt className="text-sm">{label}</dt>
      <dd className="row-span-2 self-start">
        <Metric size="sm" value={value} unit={unit} />
      </dd>
      <dd>
        <ProvenanceLabel source={source} variant={provenanceVariant}>
          {provenance}
        </ProvenanceLabel>
      </dd>
    </div>
  );
}
