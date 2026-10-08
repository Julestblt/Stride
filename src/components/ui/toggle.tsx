"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Toggle as TogglePrimitive } from "radix-ui";

const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap transition-[background-color,border-color,color] duration-150 ease-stride disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        choice:
          "min-h-10.5 rounded-surface border border-input bg-surface px-3 text-sm text-muted hover:border-dim hover:text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:font-semibold data-[state=on]:text-background",
        day: "size-11 rounded-full border border-input bg-surface text-meta font-semibold text-muted-foreground hover:border-dim hover:text-foreground data-[state=on]:border-accent data-[state=on]:bg-surface-raised data-[state=on]:text-foreground",
        segment:
          "min-h-9 px-3.5 text-meta text-muted-foreground hover:text-foreground data-[state=on]:bg-surface-raised data-[state=on]:text-foreground",
      },
    },
    defaultVariants: {
      variant: "choice",
    },
  },
);

function Toggle({
  className,
  variant = "choice",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
