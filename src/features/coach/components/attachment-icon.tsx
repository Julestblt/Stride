import { ActivityIcon, CalendarIcon, FlagIcon } from "lucide-react";
import type { AttachmentKind } from "@/features/coach/attachments";

const icons = {
  session: CalendarIcon,
  activity: ActivityIcon,
  race: FlagIcon,
} satisfies Record<AttachmentKind, unknown>;

export function AttachmentIcon({
  kind,
  className,
}: {
  kind: AttachmentKind;
  className?: string;
}) {
  const Icon = icons[kind];
  return <Icon aria-hidden="true" className={className} />;
}
