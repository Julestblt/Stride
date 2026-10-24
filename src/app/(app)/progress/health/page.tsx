import { permanentRedirect } from "next/navigation";
import { bodyHref, parseHealthView } from "@/features/progress/health";

export default async function ProgressHealthRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, date } = await searchParams;
  const scale = parseHealthView(view);
  permanentRedirect(
    bodyHref(scale, scale === "day" && typeof date === "string" ? date : null),
  );
}
