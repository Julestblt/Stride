import {
  AppHeader,
  type AppCrumb,
} from "@/features/app-shell/components/app-header";

export function GearFrame({
  crumbs,
  back,
  children,
}: {
  crumbs: AppCrumb[];
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader title="Matériel" crumbs={crumbs} back={back} />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-310 flex-col gap-7 px-5 pt-3 pb-18 sm:px-[clamp(20px,4vw,56px)] md:pt-9">
          {children}
        </main>
      </div>
    </>
  );
}
