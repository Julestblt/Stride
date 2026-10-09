import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { HistoryBackButton } from "@/features/not-found/components/history-back-button";

export const metadata: Metadata = {
  title: "404 · Page introuvable | Stride",
  description:
    "Cette page n'est pas sur le parcours. Revenez sur le bon chemin avec Stride.",
};

const desktopContours = [
  "M-20 430C90 395 165 430 260 375S430 245 535 300 685 350 760 334",
  "M-20 475C90 440 165 475 260 420S430 290 535 345 685 395 760 379",
  "M-20 520C90 485 165 520 260 465S430 335 535 390 685 440 760 424",
  "M-20 565C90 530 165 565 260 510S430 380 535 435 685 485 760 469",
  "M-20 610C90 575 165 610 260 555S430 425 535 480 685 530 760 514",
  "M-20 655C90 620 165 655 260 600S430 470 535 525 685 575 760 559",
  "M-20 700C90 665 165 700 260 645S430 515 535 570 685 620 760 604",
];

const mobileContours = [
  "M-12 145C70 105 110 138 178 104S302 49 402 77",
  "M-12 165C70 125 110 158 178 124S302 69 402 97",
  "M-12 185C70 145 110 178 178 144S302 89 402 117",
  "M-12 205C70 165 110 198 178 164S302 109 402 137",
  "M-12 225C70 185 110 218 178 184S302 129 402 157",
];

function TrailIllustration() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 740 900"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden size-full fill-none md:block"
      >
        <g className="stroke-surface-raised" strokeWidth="1.2">
          {desktopContours.map((path) => (
            <path key={path} d={path} />
          ))}
          <path d="M128 292c82-71 161-54 188 12s-80 91-155 59-34-60-33-71Z" />
        </g>
        <path
          d="M-20 830C52 780 110 723 170 706S264 682 309 581s107-134 166-160 75-34 116-101 69-76 151-96"
          className="stroke-border-strong"
          strokeDasharray="4 7"
          strokeWidth="2"
        />
        <path
          d="M-20 830C52 780 110 723 170 706S264 682 309 581s65-94 105-110"
          className="stroke-accent"
          strokeWidth="2"
        />
        <circle
          cx="414"
          cy="471"
          r="14"
          className="stroke-accent"
          strokeWidth="1.5"
        />
        <circle cx="414" cy="471" r="5" className="fill-accent" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 390 260"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-65 w-full fill-none md:hidden"
      >
        <g className="stroke-surface-raised" strokeWidth="1.1">
          {mobileContours.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
        <path
          d="M-10 240C60 193 114 189 160 173S225 142 261 105 339 62 402 50"
          className="stroke-accent"
          strokeWidth="2"
        />
        <circle
          cx="230"
          cy="135"
          r="10"
          className="stroke-accent"
          strokeWidth="1.5"
        />
        <circle cx="230" cy="135" r="4" className="fill-accent" />
      </svg>
    </>
  );
}

function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="Accueil Stride"
      className="relative z-10 inline-flex w-fit items-center gap-2 rounded-control text-foreground"
    >
      <StrideMark className="size-5" />
      <span className="font-metric text-xl font-bold tracking-wider italic">
        STRIDE
      </span>
    </Link>
  );
}

function NotFoundActions() {
  return (
    <div className="mt-auto flex flex-col gap-2.5 pt-10 md:mt-7 md:pt-0">
      <Button asChild className="w-full">
        <Link href="/">Retour à Stride</Link>
      </Button>
      <HistoryBackButton />
      <p className="pt-3 text-center text-sm text-muted-foreground">
        Pas connecté ?{" "}
        <Link
          className="font-medium text-accent hover:underline"
          href="/sign-in"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export default function NotFound() {
  return (
    <main
      lang="fr"
      className="min-h-svh bg-background md:grid md:grid-cols-[1.04fr_1fr] md:p-2"
    >
      <section
        aria-label="Stride"
        className="relative flex min-h-65 flex-col overflow-hidden px-6 pt-7 md:min-h-[calc(100svh-1rem)] md:px-8 md:py-7"
      >
        <TrailIllustration />
        <Wordmark />
        <div className="relative z-10 mt-auto hidden pb-1 md:block">
          <h2 className="text-headline font-semibold tracking-tight">
            Tu as quitté le sentier.
          </h2>
          <MonoLabel className="mt-3 block" size="micro">
            Le tracé s’arrête ici
          </MonoLabel>
        </div>
      </section>
      <section
        aria-labelledby="not-found-title"
        className="flex min-h-[calc(100svh-16.25rem)] flex-col px-6 pb-8 md:m-0 md:min-h-[calc(100svh-1rem)] md:justify-center md:rounded-panel md:border md:border-border md:bg-surface-inset md:px-8"
      >
        <div className="mx-auto flex w-full max-w-95 flex-1 flex-col md:flex-none">
          <div>
            <MonoLabel size="micro">Erreur 404</MonoLabel>
            <p
              aria-hidden="true"
              className="mt-3 font-metric text-[7rem] leading-[0.85] font-bold tracking-[-0.04em] text-accent italic sm:text-[8rem]"
            >
              404
            </p>
            <h1
              id="not-found-title"
              className="mt-5 text-headline font-semibold tracking-tight"
            >
              Page introuvable
            </h1>
            <p className="mt-3 max-w-90 text-body text-muted">
              Le lien est peut-être périmé, ou la page a été déplacée. Reviens
              sur le tracé, on repart d&apos;ici.
            </p>
          </div>
          <NotFoundActions />
        </div>
      </section>
    </main>
  );
}
