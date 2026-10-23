import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToaster } from "@/features/theme/components/theme-toaster";
import { themeScript } from "@/features/theme/model";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stride",
  description: "Ton coach running personnel, sur route et en trail.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(fontVariables, "h-full antialiased")}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <ThemeToaster />
      </body>
    </html>
  );
}
