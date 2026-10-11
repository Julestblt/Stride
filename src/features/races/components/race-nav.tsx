"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const raceSections = [
  { path: "", label: "Parcours", crumb: null },
  { path: "/roadbook", label: "Roadbook", crumb: "Roadbook" },
  { path: "/nutrition", label: "Nutrition", crumb: "Nutrition" },
  { path: "/gear", label: "Équipement", crumb: "Équipement" },
  { path: "/preparation", label: "Préparation", crumb: "Préparation" },
] as const;

const roadSections = raceSections.filter(
  (section) => section.path === "" || section.path === "/preparation",
);

const extraCrumbs: Record<string, { crumb: string; tab: string }> = {
  "/waypoints": { crumb: "Points de passage", tab: "" },
  "/course": { crumb: "Ajouter le GPX", tab: "" },
};

function sectionOf(pathname: string, base: string) {
  const rest = pathname.slice(base.length).replace(/\/$/, "");
  const extra = extraCrumbs[rest];
  if (extra) return { tab: extra.tab, crumb: extra.crumb };
  const section = raceSections.find((item) => item.path === rest);
  return { tab: section?.path ?? "", crumb: section?.crumb ?? null };
}

export function RaceBreadcrumb({
  raceId,
  name,
  replacing,
}: {
  raceId: string;
  name: string;
  replacing: boolean;
}) {
  const pathname = usePathname();
  const base = `/races/${raceId}`;
  const { crumb } = sectionOf(pathname, base);
  const label =
    crumb === "Ajouter le GPX" && replacing ? "Remplacer le GPX" : crumb;
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="flex min-w-0 flex-1 items-center gap-2 text-sm"
    >
      <Link
        href="/races"
        className="text-muted-foreground hover:text-foreground"
      >
        Courses
      </Link>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      {label ? (
        <>
          <Link
            href={base}
            className="truncate text-muted-foreground hover:text-foreground"
          >
            {name}
          </Link>
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
          <span aria-current="page" className="truncate">
            {label}
          </span>
        </>
      ) : (
        <span aria-current="page" className="truncate">
          {name}
        </span>
      )}
    </nav>
  );
}

export function RaceTabs({
  raceId,
  kind,
}: {
  raceId: string;
  kind: "road" | "trail";
}) {
  const pathname = usePathname();
  const base = `/races/${raceId}`;
  const { tab } = sectionOf(pathname, base);
  return (
    <nav
      aria-label="Sections de la course"
      className="-mx-5 flex [scrollbar-width:none] gap-6 overflow-x-auto border-b border-border px-5 sm:mx-0 sm:px-0 print:hidden"
    >
      {(kind === "road" ? roadSections : raceSections).map((section) => {
        const current = section.path === tab;
        return (
          <Link
            key={section.path}
            href={`${base}${section.path}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-0.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              current && "border-accent text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
