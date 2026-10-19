import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { Wordmark } from "./auth-shell";
import { cn } from "@/lib/utils";

export function RecoveryShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col bg-surface-inset md:bg-background">
      <header className="flex min-h-15 items-center gap-4 px-5 pt-4 md:min-h-0 md:justify-between md:px-8 md:py-5">
        <Link
          href="/sign-in"
          className="order-first -ml-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-control pr-2 text-sm text-muted hover:text-foreground md:order-last md:ml-0 md:min-h-0 md:pr-0 md:text-accent md:hover:text-accent md:hover:underline"
        >
          <ChevronLeftIcon
            aria-hidden="true"
            className="size-10 p-2.5 md:hidden"
          />
          <span aria-hidden="true" className="max-md:hidden">
            ←
          </span>
          Retour à la connexion
        </Link>
        <div className="ml-auto md:ml-0">
          <Wordmark compactOnMobile />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:mx-2 md:mb-2 md:rounded-surface md:border md:border-border md:bg-surface-inset">
        <div className="flex flex-col gap-2 px-5 pt-5 pb-5.5 md:px-8 md:pt-10 md:pb-2">
          <MonoLabel className="text-micro md:text-label">
            Mot de passe oublié · trois étapes
          </MonoLabel>
          <h1 className="text-[28px] leading-[1.08] font-semibold tracking-[-0.025em] md:text-[32px] md:leading-tight">
            Retour sur pied en une minute.
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export function RecoveryStage({
  number,
  title,
  active,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-current={active ? "step" : undefined}
      className="flex min-w-0 flex-col gap-4 border-t border-border-subtle px-5 py-6 md:gap-5 md:border-t-0 md:border-border md:p-8 md:not-first:border-l"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-6.5 shrink-0 items-center justify-center rounded-full font-metric text-body font-semibold",
            active
              ? "bg-accent text-accent-foreground"
              : "border-[1.5px] border-border-strong text-foreground",
          )}
        >
          {number}
        </span>
        <h2 className="text-lead font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function EnvelopeMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 36 28"
      className="h-7 w-9 fill-none"
      strokeWidth="1.5"
    >
      <rect
        x="1"
        y="1"
        width="34"
        height="26"
        rx="4"
        className="stroke-foreground"
      />
      <path d="M2 3 18 15 34 3" className="stroke-accent" />
    </svg>
  );
}
