"use client";

import { StandaloneError } from "@/features/not-found/components/standalone-error";
import { useResolvedTheme } from "@/features/theme/components/theme-store";
import { themeScript } from "@/features/theme/model";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";
import "./globals.css";

export default function GlobalError({ retry }: { retry: () => void }) {
  const theme = useResolvedTheme();
  return (
    <html
      lang="fr"
      data-theme={theme}
      suppressHydrationWarning
      className={cn(fontVariables, "h-full antialiased")}
    >
      <head>
        <title>Stride indisponible</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        <StandaloneError retry={retry} />
      </body>
    </html>
  );
}
