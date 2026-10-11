import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOnboardingContext } from "@/server/onboarding/context";
import { importGpx } from "@/server/races/course";
import { json, sameOrigin } from "@/server/races/request";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/races/[id]/course">,
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
  if (!(file instanceof File)) return json({ status: "invalid-file" }, 400);
  const result = await importGpx(context, id.data, file).catch(() => ({
    status: "error" as const,
  }));
  if (result.status === "saved") revalidatePath(`/races/${id.data}`, "layout");
  return json(
    result,
    result.status === "saved" ? 200 : result.status === "error" ? 500 : 422,
  );
}
