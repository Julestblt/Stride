"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EllipsisIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteFailures } from "@/features/coach/stream";
import { deleteCoachThread } from "@/server/coaching/actions";

export function ThreadMenu({
  threadId,
  busy,
}: {
  threadId: string;
  busy: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteCoachThread({ threadId });
      setConfirming(false);
      if (result.status === "deleted") {
        toast.success("Conversation supprimée.", { id: "coach-thread-delete" });
        startTransition(() => router.push("/coach"));
        return;
      }
      toast.error(deleteFailures[result.status] ?? deleteFailures.error, {
        id: "coach-thread-delete",
      });
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Plus d’options"
            className="size-11 rounded-surface min-[980px]:size-8.5"
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => setConfirming(true)}
            className="min-h-10 gap-2.5 text-danger focus:text-danger"
          >
            <Trash2Icon aria-hidden="true" className="text-danger" />
            Supprimer la conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La conversation et ses messages seront supprimés définitivement.
              Les propositions du staff restent dans l’historique du plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              aria-busy={pending}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              {pending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
