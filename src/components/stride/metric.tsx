import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const metricVariants = cva(
  "inline-flex items-baseline font-metric font-semibold tracking-[-0.01em] whitespace-nowrap tabular-nums",
  {
    variants: {
      size: {
        sm: "text-metric-sm",
        md: "text-metric",
        lg: "text-metric-lg",
        hero: "text-metric-hero",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const unitSizes = {
  sm: "ml-1",
  md: "ml-1",
  lg: "ml-1 text-[0.6em] text-muted-foreground",
  hero: "ml-0.5 text-[0.37em] text-muted-foreground",
} as const;

export function Metric({
  value,
  unit,
  size,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof metricVariants> & {
    value: React.ReactNode;
    unit?: React.ReactNode;
  }) {
  return (
    <span
      data-slot="metric"
      className={cn(metricVariants({ size }), className)}
      {...props}
    >
      {value}
      {unit && <span className={unitSizes[size ?? "md"]}>{unit}</span>}
    </span>
  );
}
