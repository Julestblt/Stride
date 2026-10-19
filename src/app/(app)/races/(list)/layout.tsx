import Link from "next/link";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { Button } from "@/components/ui/button";

export default function RacesListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader
        title="Courses"
        actions={
          <Button
            asChild
            size="md"
            className="shrink-0 rounded-surface text-meta"
          >
            <Link href="/settings/goals">
              <span aria-hidden="true">+</span>
              <span className="max-sm:sr-only">Ajouter une course</span>
            </Link>
          </Button>
        }
      />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col gap-7 px-5 pt-3 pb-18 sm:gap-9 sm:px-[clamp(20px,4vw,56px)] md:pt-10">
          {children}
        </main>
      </div>
    </>
  );
}
