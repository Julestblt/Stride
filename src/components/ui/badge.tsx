import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-tag border px-1.75 py-0.75 font-mono text-micro leading-none whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-2.5",
  {
    variants: {
      variant: {
        outline: "border-border-strong text-muted",
        accent: "border-accent/40 text-accent",
        success: "border-success-border text-success",
        warning: "border-warning/30 text-warning",
        danger: "border-danger-border text-danger",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

function Badge({
  className,
  variant = "outline",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
