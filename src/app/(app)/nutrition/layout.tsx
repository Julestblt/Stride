import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function NutritionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="relative flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-5">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <Separator
          orientation="vertical"
          className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
        />
        <p className="hidden min-w-0 flex-1 text-sm text-foreground sm:block">
          Nutrition
        </p>
        <DataActivityStatus className="hidden sm:flex md:hidden" />
        <DataActivityThread />
      </header>
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col px-5 pt-4 pb-18 sm:px-[clamp(20px,4vw,56px)] sm:pt-10">
          {children}
        </main>
      </div>
    </>
  );
}
