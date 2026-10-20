import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "name", label: "Par son nom", href: "/gear/new" },
  { key: "garmin", label: "Depuis Garmin", href: "/gear/import" },
] as const;

export function AddTabs({
  current,
}: {
  current: (typeof tabs)[number]["key"];
}) {
  return (
    <nav
      aria-label="Façon d’ajouter"
      className="flex max-w-105 gap-1 rounded-card border border-border bg-surface p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center rounded-control px-2 text-center text-sm",
            tab.key === current
              ? "bg-border font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
