import { ChevronLeftIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { MonoLabel } from "@/components/stride/mono-label";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { ThemeSwitcher } from "@/features/theme/components/theme-switcher";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type AppCrumb = { label: string; href?: string };

const sidebarLabel = "Afficher ou masquer la barre latérale";

function Crumbs({ crumbs, detail }: { crumbs: AppCrumb[]; detail?: string }) {
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb.label} className="flex min-w-0 items-center gap-2">
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
                className={last ? "truncate" : "truncate text-muted-foreground"}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
      {detail && (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="truncate text-muted-foreground">{detail}</span>
        </>
      )}
    </nav>
  );
}

export function AppHeader({
  title,
  detail,
  crumbs,
  breadcrumb,
  back,
  actions,
  className,
}: {
  title: string;
  detail?: string;
  crumbs?: AppCrumb[];
  breadcrumb?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative flex shrink-0 items-center gap-2.5 px-5 pt-3.5 pb-1 md:min-h-14 md:gap-3 md:border-b md:border-border-subtle md:py-0",
        className,
      )}
    >
      {back && (
        <Link
          href={back.href}
          aria-label={back.label}
          className="-my-1.5 -ml-3 grid size-11 shrink-0 place-items-center rounded-control text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:hidden"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-5" />
        </Link>
      )}
      <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center md:hidden">
        {back ? (
          <MonoLabel className="truncate">{title}</MonoLabel>
        ) : (
          <>
            <p className="truncate text-title font-semibold tracking-[-0.02em]">
              {title}
            </p>
            {detail && (
              <span className="text-xs text-muted-foreground">{detail}</span>
            )}
          </>
        )}
      </div>
      <SidebarTrigger aria-label={sidebarLabel} className="max-md:hidden" />
      <Separator
        orientation="vertical"
        className="max-md:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <div className="flex min-w-0 flex-1 max-md:hidden">
        {breadcrumb ?? (
          <Crumbs crumbs={crumbs ?? [{ label: title }]} detail={detail} />
        )}
      </div>
      {actions}
      <ThemeSwitcher />
      <NotificationBell />
      <DataActivityStatus short className="shrink-0 md:hidden" />
      <SidebarTrigger
        aria-label={sidebarLabel}
        className="-mr-2 size-11 shrink-0 md:hidden"
      />
      <DataActivityThread />
    </header>
  );
}
