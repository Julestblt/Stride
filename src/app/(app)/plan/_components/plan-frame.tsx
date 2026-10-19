import {
  AppHeader,
  type AppCrumb,
} from "@/features/app-shell/components/app-header";
import { cn } from "@/lib/utils";

export function PlanFrame({
  crumbs,
  back,
  className,
  children,
}: {
  crumbs: AppCrumb[];
  back?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader
        title={back ? crumbs.map((crumb) => crumb.label).join(" / ") : "Plan"}
        crumbs={crumbs}
        back={back}
      />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main
          className={cn(
            "mx-auto flex w-full max-w-360 flex-col gap-7 px-5 pt-3 pb-18 sm:gap-9 sm:px-[clamp(20px,4vw,56px)] md:pt-10",
            className,
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
