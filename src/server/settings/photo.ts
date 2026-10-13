import "server-only";
import sharp from "sharp";
import { z } from "zod";
import type { OnboardingContext } from "@/server/onboarding/context";

export async function uploadProfilePhoto(
  context: OnboardingContext,
  file: File,
) {
  if (
    !z
      .object({
        size: z
          .number()
          .int()
          .positive()
          .max(2 * 1024 * 1024),
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .safeParse({ size: file.size, type: file.type }).success
  )
    return { error: "Choisis une image de moins de 2 Mo." } as const;
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    ? "image/jpeg"
    : bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : null;
  if (!mime || mime !== file.type)
    return { error: "Choisis une image JPEG, PNG ou WebP valide." } as const;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      return { error: "Choisis une image fixe valide." } as const;
    await image.raw().toBuffer();
  } catch {
    return { error: "Choisis une image JPEG, PNG ou WebP valide." } as const;
  }
  const path = `${context.userId}/${crypto.randomUUID()}.${mime.split("/")[1]}`;
  const { error } = await context.client.storage
    .from("profile-images")
    .upload(path, bytes, { contentType: mime });
  return error
    ? ({ error: "L’import de la photo a échoué. Réessaie." } as const)
    : ({ path } as const);
}
export async function profilePhotoUrl(
  context: OnboardingContext,
  path: string | null,
) {
  if (!path || !path.startsWith(`${context.userId}/`)) return null;
  const { data, error } = await context.client.storage
    .from("profile-images")
    .createSignedUrl(path, 3600);
  const parsed = z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol))
    .safeParse(data?.signedUrl);
  return error || !parsed.success ? null : parsed.data;
}
