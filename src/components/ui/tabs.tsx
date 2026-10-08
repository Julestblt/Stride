"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex w-fit max-w-full items-center gap-5 overflow-x-auto text-sm",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent py-1 whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-stride hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-accent data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
