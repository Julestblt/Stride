import { BellIcon } from "./bell-icon";
import { cn } from "@/lib/utils";

export function NotificationEmpty({
  filtered = false,
  className,
}: {
  filtered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 px-10 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-panel border border-dashed border-border-strong text-muted-foreground">
        <BellIcon className="size-5.5" />
      </span>
      <h2 className="text-lg font-semibold">
        {filtered ? "Rien dans ce filtre" : "Tu es à jour"}
      </h2>
      <p className="max-w-80 text-sm leading-normal text-muted-foreground">
        {filtered
          ? "Aucune notification de ce type sur les 30 derniers jours."
          : "Les messages du staff et les changements de ton plan arriveront ici."}
      </p>
    </div>
  );
}
