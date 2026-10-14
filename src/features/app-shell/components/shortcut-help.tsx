"use client";

import * as React from "react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { useDataActivityNavigation } from "@/features/data-activity/components/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { SearchIcon, ActivityIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountMenuKeyboardIcon } from "./account-menu-icons";

const OPEN_SHORTCUT_HELP_EVENT = "stride:open-shortcut-help";

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, [contenteditable='true']") !==
        null)
  );
}

function Shortcut({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-control border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  label,
  keys,
  query,
  terms = "",
}: {
  label: string;
  keys: React.ReactNode;
  query: string;
  terms?: string;
}) {
  if (!matchesShortcutSearch(label, terms, query)) {
    return null;
  }

  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-1">{keys}</span>
    </div>
  );
}

function matchesShortcutSearch(label: string, terms: string, query: string) {
  return `${label} ${terms}`
    .toLocaleLowerCase("fr-FR")
    .includes(query.toLocaleLowerCase("fr-FR"));
}

export function ShortcutHelp() {
  const isMobile = useIsMobile();
  const navigate = useDataActivityNavigation();
  const [surface, setSurface] = React.useState<"desktop" | "mobile" | null>(
    null,
  );
  const [query, setQuery] = React.useState("");
  const [windowsKeys, setWindowsKeys] = React.useState(false);
  const goTimeout = React.useRef<number | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const isMac = !windowsKeys;
  const modifier = isMac ? "⌘" : "Ctrl";
  const visibleRows = [
    ["Ouvrir les activités", "g a"],
    ["Ouvrir les réglages", "g r"],
    ["Réduire la barre latérale", "⌘ b ctrl b"],
    ["Réglages", "⌘ , ctrl ,"],
    ["Raccourcis clavier", "?"],
    ["Rechercher dans cette aide", "/"],
  ].filter(([label, terms]) =>
    matchesShortcutSearch(label, terms, query),
  ).length;
  const navigationKeys = (key: string) => (
    <>
      <Shortcut>G</Shortcut>
      <span className="text-xs text-muted-foreground">puis</span>
      <Shortcut>{key}</Shortcut>
    </>
  );
  const syncPlatform = React.useCallback(() => {
    setWindowsKeys(!/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  React.useEffect(() => {
    const openHelpFromMenu = () => {
      syncPlatform();
      setQuery("");
      setSurface(isMobile ? "mobile" : "desktop");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (goTimeout.current !== null) {
        window.clearTimeout(goTimeout.current);
        goTimeout.current = null;
        if (event.key.toLowerCase() === "a") {
          navigate("/activities");
          return;
        }
        if (event.key.toLowerCase() === "r") {
          navigate("/settings");
          return;
        }
      }
      if (
        (event.key === "?" || (event.code === "Slash" && event.shiftKey)) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        syncPlatform();
        setSurface("desktop");
        setQuery("");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        navigate("/settings");
        return;
      }
      if (event.key === "/" && surface === "desktop") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key.toLowerCase() === "g" && !event.metaKey && !event.ctrlKey) {
        goTimeout.current = window.setTimeout(() => {
          goTimeout.current = null;
        }, 800);
      }
    };
    window.addEventListener(OPEN_SHORTCUT_HELP_EVENT, openHelpFromMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_SHORTCUT_HELP_EVENT, openHelpFromMenu);
      window.removeEventListener("keydown", onKeyDown);
      if (goTimeout.current !== null) window.clearTimeout(goTimeout.current);
    };
  }, [isMobile, navigate, surface, syncPlatform]);

  return (
    <>
      <DialogPrimitive.Root
        open={surface === "desktop"}
        onOpenChange={(open) => setSurface(open ? "desktop" : null)}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/75 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90svh,54rem)] w-[min(820px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-surface border border-border-strong bg-popover text-popover-foreground shadow-xl outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
              <div>
                <DialogPrimitive.Title className="font-semibold text-foreground">
                  Raccourcis clavier
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  Les raccourcis disponibles dans Stride.
                </DialogPrimitive.Description>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-control border border-border p-0.5">
                  <Button
                    size="sm"
                    variant={isMac ? "secondary" : "ghost"}
                    onClick={() => setWindowsKeys(false)}
                  >
                    Mac ⌘
                  </Button>
                  <Button
                    size="sm"
                    variant={!isMac ? "secondary" : "ghost"}
                    onClick={() => setWindowsKeys(true)}
                  >
                    Windows · Linux Ctrl
                  </Button>
                </div>
                <DialogPrimitive.Close asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    Fermer <Shortcut>Échap</Shortcut>
                    <span className="sr-only">
                      Fermer les raccourcis clavier
                    </span>
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              <label className="relative mb-5 block">
                <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un raccourci…"
                  className="pr-12 pl-9"
                  aria-label="Rechercher un raccourci"
                />
              </label>

              <div className="grid gap-x-10 md:grid-cols-2">
                <section aria-labelledby="shortcut-navigation">
                  <h3
                    id="shortcut-navigation"
                    className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase"
                  >
                    Navigation
                  </h3>
                  <ShortcutRow
                    label="Ouvrir les activités"
                    terms="g a"
                    query={query}
                    keys={navigationKeys("A")}
                  />
                  <ShortcutRow
                    label="Ouvrir les réglages"
                    terms="g r"
                    query={query}
                    keys={navigationKeys("R")}
                  />
                  <ShortcutRow
                    label="Réduire la barre latérale"
                    terms="⌘ b ctrl b"
                    query={query}
                    keys={
                      <>
                        <Shortcut>{modifier}</Shortcut>
                        <Shortcut>B</Shortcut>
                      </>
                    }
                  />
                  <ShortcutRow
                    label="Réglages"
                    terms="⌘ , ctrl ,"
                    query={query}
                    keys={
                      <>
                        <Shortcut>{modifier}</Shortcut>
                        <Shortcut>,</Shortcut>
                      </>
                    }
                  />
                  <ShortcutRow
                    label="Raccourcis clavier"
                    terms="?"
                    query={query}
                    keys={<Shortcut>?</Shortcut>}
                  />
                </section>
                <section
                  aria-labelledby="shortcut-commands"
                  className="mt-6 md:mt-0"
                >
                  <h3
                    id="shortcut-commands"
                    className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase"
                  >
                    Commandes
                  </h3>
                  <ShortcutRow
                    label="Rechercher dans cette aide"
                    terms="/"
                    query={query}
                    keys={<Shortcut>/</Shortcut>}
                  />
                  <p className="py-2 text-sm text-muted-foreground">
                    Les actions de navigation affichées ici sont disponibles
                    dans cette version.
                  </p>
                </section>
              </div>
              {visibleRows === 0 && (
                <p
                  role="status"
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Aucun raccourci trouvé.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
              <span className="text-sm text-muted-foreground">
                Seules les commandes disponibles sont affichées.
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href="/activities" onClick={() => setSurface(null)}>
                  Voir les activités <ActivityIcon />
                </Link>
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Sheet
        open={surface === "mobile"}
        onOpenChange={(open) => setSurface(open ? "mobile" : null)}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[92svh] gap-0 overflow-hidden rounded-t-card border-border-strong bg-popover px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <SheetTitle>Gestes et commandes</SheetTitle>
              <SheetDescription className="mt-1">
                Retrouvez les principales sections de Stride.
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSurface(null)}
              aria-label="Fermer les gestes et commandes"
            >
              <XIcon />
            </Button>
          </div>
          <Button
            asChild
            variant="outline"
            className="mb-3 h-12 justify-start gap-3"
          >
            <Link href="/activities" onClick={() => setSurface(null)}>
              <ActivityIcon className="text-accent" /> Voir les activités
            </Link>
          </Button>
          <div className="mb-5 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/activities" onClick={() => setSurface(null)}>
                Activités
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings" onClick={() => setSurface(null)}>
                Réglages
              </Link>
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <h3 className="mb-2 font-mono text-xs tracking-wider text-muted-foreground uppercase">
              Navigation tactile
            </h3>
            <div className="divide-y divide-border">
              <GestureRow
                icon="↕"
                title="Faire défiler une liste"
                detail="Parcourir les activités et les réglages."
              />
              <GestureRow
                icon="↗"
                title="Toucher une activité"
                detail="Ouvrir le détail de la séance."
              />
              <GestureRow
                icon="×"
                title="Fermer cette feuille"
                detail="Touchez × pour fermer cette feuille."
              />
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Clavier connecté ? Appuyez sur <Shortcut>?</Shortcut> pour ouvrir
            l’aide complète.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ShortcutHelpMenuItem() {
  return (
    <DropdownMenuItem
      className="min-h-9 gap-2.5 px-2.5 text-sm [&_svg]:text-muted-foreground"
      onSelect={() => window.dispatchEvent(new Event(OPEN_SHORTCUT_HELP_EVENT))}
    >
      <AccountMenuKeyboardIcon />
      <span className="md:hidden">Gestes et commandes</span>
      <span className="hidden md:inline">Raccourcis clavier</span>
    </DropdownMenuItem>
  );
}

function GestureRow({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-control border border-border bg-surface-raised font-mono text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}
