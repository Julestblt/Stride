import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import {
  ProgressBreadcrumb,
  ProgressTabs,
} from "@/features/progress/components/progress-nav";
import { getShell } from "@/server/app/shell";

export default async function ProgressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sync } = await getShell();
  return (
    <>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-5">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <Separator
          orientation="vertical"
          className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
        />
        <div className="hidden min-w-0 flex-1 sm:flex">
          <ProgressBreadcrumb />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col px-5 pt-4 pb-18 sm:px-[clamp(20px,4vw,56px)] sm:pt-10">
          <div className="mb-6.5 flex flex-col gap-3.5 sm:mb-3">
            <div className="flex min-h-11 items-center gap-2 sm:hidden">
              <p className="text-[28px] font-semibold tracking-[-0.025em]">
                Progression
              </p>
              {sync && (
                <MonoLabel
                  size="micro"
                  className="ml-auto flex items-center gap-1.5"
                >
                  <PulseDot tone="provider" breathing={false} />
                  {`Garmin · ${sync}`}
                </MonoLabel>
              )}
            </div>
            <ProgressTabs />
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
