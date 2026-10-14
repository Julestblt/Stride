import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StrideMark } from "@/components/stride/stride-mark";

export type Crumb = { label: string; href?: string };

export function PlanFrame({
  crumbs,
  children,
}: {
  crumbs: Crumb[];
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
        <nav
          aria-label="Fil d’Ariane"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm max-sm:invisible"
        >
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <span
                key={crumb.label}
                className="flex min-w-0 items-center gap-2"
              >
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted-foreground">
                    /
                  </span>
                )}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={
                      last ? "truncate" : "truncate text-muted-foreground"
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <DataActivityStatus className="md:hidden" />
        <DataActivityThread />
      </header>
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col gap-7 px-5 pt-6 pb-18 sm:gap-9 sm:px-[clamp(20px,4vw,56px)] sm:pt-10">
          {children}
        </main>
      </div>
    </>
  );
}

export function DraftBanner() {
  return (
    <div className="flex items-start gap-3 rounded-card border border-warning-border bg-surface-inset px-4 py-3">
      <StrideMark className="mt-0.5 size-3.5 shrink-0" />
      <p className="text-meta text-muted">
        <span className="font-semibold text-foreground">Brouillon</span> calculé
        par Stride à partir de tes données. Il n’est pas encore enregistré ni
        revu par le coach.
      </p>
    </div>
  );
}
