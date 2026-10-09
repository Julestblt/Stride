import Link from "next/link";
import { redirect } from "next/navigation";
import { onboardingEnabled } from "@/server/onboarding/environment";
import { getOnboardingContext } from "@/server/onboarding/context";
import { ensureProgress } from "@/server/onboarding/progress";
import { onboardingPath, resumeStep } from "@/features/onboarding/progress";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user && onboardingEnabled()) {
    const context = await getOnboardingContext();
    if (!context) redirect("/sign-in");
    const progress = await ensureProgress(context).catch(() => null);
    if (!progress) redirect("/onboarding");
    if (!progress.completed_at) redirect(onboardingPath(resumeStep(progress)));
  }
  return (
    <main className="flex min-h-svh flex-col px-5 sm:px-10 lg:px-24">
      <header className="flex min-h-22 items-center justify-between border-b border-border">
        <Link
          className="inline-flex items-center gap-2.5 rounded-control text-lg font-semibold tracking-tight text-foreground"
          href="/"
          aria-label="Stride home"
        >
          <span
            className="grid size-7 place-items-center rounded-control bg-accent font-metric text-xl font-bold text-accent-foreground"
            aria-hidden="true"
          >
            S
          </span>
          <span>stride</span>
        </Link>
        {user ? (
          <div className="flex flex-col items-end gap-1 py-3 text-right">
            <p className="max-w-50 text-sm break-all text-muted sm:max-w-none">
              Connecté en tant que :{" "}
              <span className="text-foreground">{user.email}</span>
            </p>
            <SignOutButton />
          </div>
        ) : (
          <Link className="text-sm text-accent hover:underline" href="/sign-in">
            Se connecter
          </Link>
        )}
      </header>
      <section
        className="m-auto w-full max-w-4xl py-20 sm:pt-28 sm:pb-32"
        aria-labelledby="intro-title"
      >
        <p className="flex items-center gap-2.5 font-mono text-xs tracking-wide text-muted uppercase">
          <span
            className="size-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />{" "}
          Built for the long run
        </p>
        <h1
          id="intro-title"
          className="mt-8 mb-6 font-metric text-6xl leading-none font-semibold tracking-tighter sm:text-8xl lg:text-9xl"
        >
          Your running,
          <br />
          <span className="text-accent">with context.</span>
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          Road miles, trail days, race goals, recovery. Stride is being built to
          bring the whole picture of your training together.
        </p>
        <div className="mt-16 flex max-w-lg items-center gap-4 border-y border-border py-4">
          <span className="font-mono text-xs tracking-wide text-accent">
            01
          </span>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Personal coaching starts with understanding the athlete behind every
            run.
          </p>
          <span className="text-xl text-accent" aria-hidden="true">
            ↗
          </span>
        </div>
      </section>
      <footer className="flex min-h-19 flex-col items-start justify-center gap-2 border-t border-border py-4 font-mono text-xs tracking-wide text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Road and trail, in one stride.</span>
        <span>Personal running coach · In foundation</span>
      </footer>
    </main>
  );
}
