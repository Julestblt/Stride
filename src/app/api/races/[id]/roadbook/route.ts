import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOnboardingContext } from "@/server/onboarding/context";
import { importLink, importRoadbookFile } from "@/server/races/roadbook";
import { json, sameOrigin } from "@/server/races/request";

const linkSchema = z.object({
  link: z.string().trim().min(8).max(2000),
  intent: z.enum(["course", "roadbook"]),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/races/[id]/roadbook">,
) {
  if (!sameOrigin(request)) return json({ status: "forbidden" }, 403);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return json({ status: "missing" }, 404);
  const context = await getOnboardingContext({ writable: true }).catch(
    () => null,
  );
  if (!context) return json({ status: "session-expired" }, 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const link = linkSchema.safeParse({
    link: form?.get("link"),
    intent: form?.get("intent"),
  });
  const result = await (
    file instanceof File
      ? importRoadbookFile(context, id.data, file)
      : link.success
        ? importLink(context, id.data, link.data.link, link.data.intent)
        : Promise.resolve({ status: "invalid-link" as const })
  ).catch(() => ({ status: "error" as const }));
  const saved =
    result.status === "roadbook-saved" || result.status === "course-saved";
  if (saved) revalidatePath(`/races/${id.data}`, "layout");
  return json(result, saved ? 200 : result.status === "error" ? 500 : 422);
}
