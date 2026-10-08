import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";

export function SectionHeader({
  title,
  meta,
  action,
  as: Heading = "h2",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-baseline justify-between gap-3", className)}
      {...props}
    >
      <Heading className="text-xl font-semibold tracking-tight text-balance">
        {title}
      </Heading>
      {meta && (
        <MonoLabel className="shrink-0 text-right max-sm:hidden">
          {meta}
        </MonoLabel>
      )}
      {action}
    </div>
  );
}
