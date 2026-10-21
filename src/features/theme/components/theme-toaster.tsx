"use client";

import { Toaster } from "@/components/ui/sonner";
import { useResolvedTheme } from "./theme-store";

export function ThemeToaster() {
  return <Toaster theme={useResolvedTheme()} />;
}
