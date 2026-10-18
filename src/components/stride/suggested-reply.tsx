import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SuggestedReplies({
  replies,
  onSelect,
  disabled = false,
  className,
}: {
  replies: readonly string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (replies.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Réponses suggérées"
      data-slot="suggested-replies"
      className={cn(
        "flex gap-1.5 max-md:-my-1.5 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:py-1.5 md:flex-wrap",
        className,
      )}
    >
      {replies.map((reply) => (
        <Button
          key={reply}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onSelect(reply)}
          className="h-auto min-h-11 rounded-full px-3.5 text-meta text-muted hover:text-foreground motion-reduce:transition-none md:min-h-8 md:rounded-surface md:px-2.5"
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}
