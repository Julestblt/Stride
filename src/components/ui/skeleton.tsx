import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "rounded-control bg-surface-raised bg-linear-to-r from-surface-raised via-border to-surface-raised bg-size-[200%_100%] motion-safe:animate-data-sheen",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
