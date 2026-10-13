import Link from "next/link";
import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function RacesListLayout({
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
        <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1 text-sm">
          <span aria-current="page">Courses</span>
        </nav>
        <DataActivityStatus className="md:hidden" />
        <Button asChild size="md" className="rounded-surface text-meta">
          <Link href="/settings/goals">
            <span aria-hidden="true">+</span>
            <span className="max-sm:sr-only">Ajouter une course</span>
          </Link>
        </Button>
        <DataActivityThread />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col gap-7 px-5 pt-6 pb-18 sm:gap-9 sm:px-[clamp(20px,4vw,56px)] sm:pt-10">
          {children}
        </main>
      </div>
    </>
  );
}
