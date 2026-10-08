import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./auth-shell";
import { cn } from "@/lib/utils";

export function RecoveryShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-8">
        <Wordmark />
        <Link href="/sign-in" className="text-sm text-accent hover:underline">
          ← Back to sign in
        </Link>
      </header>
      <div className="mx-2 mb-2 flex flex-1 flex-col rounded-surface border border-border bg-surface-inset">
        <div className="flex flex-col gap-2 px-6 pt-10 pb-2 md:px-8">
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Password recovery · three moments
          </p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em] md:text-[32px]">
            Back on your feet in a minute.
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
      className="flex min-w-0 flex-col gap-5 border-border p-6 max-md:border-t md:p-8 md:not-first:border-l"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-6.5 shrink-0 items-center justify-center rounded-full font-metric text-[15px]",
            active
              ? "bg-accent text-accent-foreground"
              : "border border-border text-muted",
          )}
        >
          {number}
        </span>
        <h2 className="text-[17px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
