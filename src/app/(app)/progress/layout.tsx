import { AppHeader } from "@/features/app-shell/components/app-header";
import {
  ProgressBreadcrumb,
  ProgressTabs,
} from "@/features/progress/components/progress-nav";

export default async function ProgressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader title="Progression" breadcrumb={<ProgressBreadcrumb />} />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col px-5 pt-3 pb-18 sm:px-[clamp(20px,4vw,56px)] md:pt-10">
          <div className="mb-6.5 sm:mb-3">
            <ProgressTabs />
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
