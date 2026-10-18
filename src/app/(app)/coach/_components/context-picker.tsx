"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonoLabel } from "@/components/stride/mono-label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  attachmentCountLabel,
  attachmentEmptyLabels,
  attachmentGroups,
  attachmentKinds,
  attachmentMeta,
  attachmentTabLabels,
  maxAttachments,
  sameAttachment,
  type AttachmentKind,
  type AttachmentOption,
  type AttachmentOptions,
} from "@/features/coach/attachments";
import { AttachmentIcon } from "@/features/coach/components/attachment-icon";

function OptionRow({
  option,
  selected,
  disabled,
  today,
  onToggle,
}: {
  option: AttachmentOption;
  selected: boolean;
  disabled: boolean;
  today: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className="group/row grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)_22px] items-center gap-3 rounded-surface border border-transparent px-2.5 py-2 text-left transition-colors duration-150 ease-stride outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent aria-pressed:border-border-strong aria-pressed:bg-surface-raised"
    >
      <span className="flex size-8.5 items-center justify-center rounded-surface bg-surface-raised text-muted group-aria-pressed/row:bg-border group-aria-pressed/row:text-accent">
        <AttachmentIcon kind={option.kind} className="size-3.75" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {option.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {attachmentMeta(option, today)}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex size-5.5 items-center justify-center rounded-control border border-border-strong text-transparent group-aria-pressed/row:border-accent group-aria-pressed/row:bg-accent group-aria-pressed/row:text-accent-foreground"
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    </button>
  );
}

export function ContextPicker({
  open,
  onOpenChange,
  options,
  selected,
  today,
  onToggle,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AttachmentOptions;
  selected: readonly AttachmentOption[];
  today: string;
  onToggle: (option: AttachmentOption) => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const mobile = useIsMobile();
  const [tab, setTab] = useState<AttachmentKind>(
    () => attachmentKinds.find((kind) => options[kind].length > 0) ?? "session",
  );
  const full = selected.length >= maxAttachments;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        className={cn(
          "gap-0 border-border bg-surface-panel",
          mobile
            ? "max-h-[85svh] rounded-t-[18px]"
            : "data-[side=right]:w-110 data-[side=right]:sm:max-w-110",
        )}
      >
        {mobile && (
          <span
            aria-hidden="true"
            className="mt-2 h-1 w-9 shrink-0 self-center rounded-full bg-border-strong"
          />
        )}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AttachmentKind)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="flex flex-col gap-3.5 px-4 pt-3 pb-2.5 md:gap-4 md:px-5.5 md:pt-5.5 md:pb-3.5">
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <SheetTitle className="text-lg font-semibold">
                  Ajouter du contexte
                </SheetTitle>
                <SheetDescription className="text-meta leading-[1.45] text-muted-foreground">
                  Le staff reçoit la fiche complète de chaque élément joint.
                  Trois au plus par message.
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Fermer"
                  className="size-11 shrink-0 rounded-surface md:size-10"
                >
                  <XIcon aria-hidden="true" className="size-3" />
                </Button>
              </SheetClose>
            </div>
            <TabsList
              aria-label="Type de contexte"
              className="w-full gap-1 rounded-surface border border-border bg-surface p-1"
            >
              {attachmentKinds.map((kind) => (
                <TabsTrigger
                  key={kind}
                  value={kind}
                  className="min-h-9 flex-1 justify-center rounded-control border-b-0 py-0 text-meta outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-border data-[state=active]:font-semibold"
                >
                  {attachmentTabLabels[kind]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {attachmentKinds.map((kind) => {
            const groups = attachmentGroups(kind, options[kind], today);
            return (
              <TabsContent
                key={kind}
                value={kind}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 md:px-3 md:pb-3"
              >
                {groups.length === 0 ? (
                  <p className="px-2.5 py-6 text-sm text-muted">
                    {attachmentEmptyLabels[kind]}
                  </p>
                ) : (
                  groups.map((group) => (
                    <section
                      key={group.label}
                      aria-label={group.label}
                      className="flex flex-col gap-0.5"
                    >
                      <MonoLabel size="nano" className="px-2.5 pt-3 pb-1">
                        {group.label}
                      </MonoLabel>
                      <ul className="flex flex-col gap-0.5">
                        {group.options.map((option) => {
                          const isSelected = selected.some((item) =>
                            sameAttachment(item, option),
                          );
                          return (
                            <li key={option.id}>
                              <OptionRow
                                option={option}
                                selected={isSelected}
                                disabled={full && !isSelected}
                                today={today}
                                onToggle={() => onToggle(option)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
        <div className="flex items-center gap-3 border-t border-border px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:px-5.5 md:py-3.5">
          <p role="status" className="flex-1 text-meta text-muted">
            {attachmentCountLabel(selected.length)}
          </p>
          <SheetClose asChild>
            <Button className="min-h-11 px-4.5">Terminé</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
