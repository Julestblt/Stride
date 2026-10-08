import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Wordmark() {
  return (
    <Link
      href="/sign-in"
      aria-label="Stride sign in"
      className="relative inline-flex w-fit items-center gap-2.5 text-foreground"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-6 fill-none stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="m5 21 7-18m0 18 7-18" />
      </svg>
      <span className="font-metric text-2xl font-bold tracking-wider italic">
        STRIDE
      </span>
    </Link>
  );
}

function Terrain({ signup }: { signup: boolean }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 740 900"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden h-full w-full fill-none md:block"
      >
        <g className="stroke-surface-raised" strokeWidth="1.2">
          {Array.from({ length: 9 }, (_, index) => (
            <path
              key={index}
              d={`M-20 ${430 + index * 43} C90 ${395 + index * 43} 165 ${430 + index * 43} 260 ${375 + index * 43} S430 ${245 + index * 43} 535 ${300 + index * 43} S685 ${350 + index * 43} 760 ${334 + index * 43}`}
            />
          ))}
          <path d="M128 292c82-71 161-54 188 12s-80 91-155 59-34-60-33-71Z" />
          {!signup && (
            <path d="M155 301c61-45 105-35 125 6s-77 44-108 28-21-27-17-34Z" />
          )}
        </g>
        <path
          d="M-20 830C52 780 110 723 170 706S264 682 309 581"
          className="stroke-accent"
          strokeWidth="2"
        />
        <path
          d="M309 581C353 482 416 447 475 421S550 387 591 320 660 244 742 224"
          className={signup ? "stroke-muted-foreground" : "stroke-accent"}
          strokeWidth="2"
          strokeDasharray={signup ? "4 6" : undefined}
        />
        <circle
          cx={signup ? 309 : 591}
          cy={signup ? 581 : 320}
          r="4"
          className="fill-accent"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 390 240"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full fill-none md:hidden"
      >
        <g className="stroke-surface-raised" strokeWidth="1.1">
          {Array.from({ length: 5 }, (_, index) => (
            <path
              key={index}
              d={`M-12 ${145 + index * 20}C70 ${105 + index * 20} 110 ${138 + index * 20} 178 ${104 + index * 20}S302 ${49 + index * 20} 402 ${77 + index * 20}`}
            />
          ))}
        </g>
        <path
          d="M-10 240C60 193 114 189 160 173S225 142 261 105 339 62 402 50"
          className="stroke-accent"
          strokeWidth="2"
        />
      </svg>
    </>
  );
}

export function AuthShell({
  children,
  signup = false,
}: {
  children: ReactNode;
  signup?: boolean;
}) {
  return (
    <main className="flex min-h-svh flex-col md:grid md:grid-cols-[1.04fr_1fr]">
      <section
        aria-label="Stride"
        className="relative flex h-60 shrink-0 flex-col justify-between overflow-hidden px-6 pt-14 md:h-auto md:min-h-svh md:px-10 md:py-8"
      >
        <Terrain signup={signup} />
        <Wordmark />
        <div className="relative hidden max-w-130 flex-col gap-5 md:flex">
          <p className="text-[clamp(34px,3.6vw,48px)] leading-[1.04] font-semibold tracking-[-0.03em]">
            {signup
              ? "About six minutes to a coach that has read your whole training history."
              : "Your coach already knows where you've been."}
          </p>
          {signup ? (
            <ol className="flex flex-col gap-2.5 text-[15px] text-muted">
              {[
                "Create your account",
                "Connect Garmin — we import your history",
                "Fill the few gaps Garmin can't",
                "Meet your athlete profile",
              ].map((label, index) => (
                <li key={label} className="flex gap-3">
                  <span
                    className={cn(
                      "w-3.5 font-metric text-[17px]",
                      index === 0 ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          ) : (
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              Road &amp; trail · Built on your Garmin history
            </p>
          )}
        </div>
      </section>
      <section
        aria-label={signup ? "Create account" : "Sign in"}
        className="flex flex-1 flex-col px-6 pb-8 md:m-2 md:justify-center md:rounded-surface md:border md:border-border md:bg-surface-inset md:py-12"
      >
        <div className="mx-auto flex w-full max-w-95 flex-1 flex-col md:flex-none">
          {children}
        </div>
      </section>
    </main>
  );
}
