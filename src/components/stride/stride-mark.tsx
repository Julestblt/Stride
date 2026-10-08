import { cn } from "@/lib/utils";

export function StrideMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-4 fill-none stroke-accent", className)}
      strokeWidth="2"
      strokeLinecap="round"
      {...props}
    >
      <path d="M4.5 13.5 8.5 2.5M9 13.5l4-11" />
    </svg>
  );
}
