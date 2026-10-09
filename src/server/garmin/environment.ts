import "server-only";
import { z } from "zod";

const garminApiUrlSchema = z
  .string()
  .url()
  .transform((value, context) => {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      context.addIssue({
        code: "custom",
        message: "GARMIN_API_URL must be an HTTP or HTTPS origin.",
      });
      return z.NEVER;
    }
    return url.origin;
  });

export function parseGarminApiUrl(value: unknown) {
  return garminApiUrlSchema.parse(value);
}
