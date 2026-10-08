"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { toggleVariants } from "@/components/ui/toggle";

type ToggleGroupVariant = VariantProps<typeof toggleVariants>["variant"];

const ToggleGroupContext = React.createContext<ToggleGroupVariant>("choice");

function ToggleGroup({
  className,
  variant = "choice",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  variant?: ToggleGroupVariant;
}) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      className={cn(
        "flex flex-wrap items-center gap-2",
        variant === "segment" &&
          "w-fit flex-nowrap gap-0 overflow-hidden rounded-surface border border-border",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={variant}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const variant = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={variant}
      className={cn(
        toggleVariants({ variant }),
        variant === "segment" && "border-l border-border first:border-l-0",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
