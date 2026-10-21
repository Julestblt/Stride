"use client";

import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  parseThemePreference,
  themeButtonLabel,
  themeLabels,
  themePreferences,
  type ThemePreference,
} from "../model";
import { setThemePreference, useThemePreference } from "./theme-store";

const icons: Record<ThemePreference, LucideIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export function ThemeSwitcher({ className }: { className?: string }) {
  const preference = useThemePreference();
  const Icon = icons[preference];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={themeButtonLabel(preference)}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-control border border-transparent text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-surface-raised aria-expanded:text-foreground md:size-8.5 md:border-border md:aria-expanded:border-border-strong",
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-4.5 md:size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44">
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) =>
            setThemePreference(parseThemePreference(value))
          }
        >
          {themePreferences.map((option) => {
            const OptionIcon = icons[option];
            return (
              <DropdownMenuRadioItem key={option} value={option}>
                <OptionIcon aria-hidden="true" className="text-muted" />
                {themeLabels[option]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
