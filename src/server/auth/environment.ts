import "server-only";
import { z } from "zod";

const siteUrlSchema = z
  .string()
  .url()
  .transform((value, context) => {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    ) {
      context.addIssue({
        code: "custom",
        message: "SITE_URL must be an HTTPS origin or local HTTP origin.",
      });
      return z.NEVER;
    }
    return url.origin;
  });

export function parseSiteUrl(value: unknown) {
  return siteUrlSchema.parse(value);
}

export function callbackUrl(next: "/" | "/reset-password" = "/") {
  const url = new URL("/auth/callback", parseSiteUrl(process.env.SITE_URL));
  url.searchParams.set("next", next);
  return url.toString();
}

export function safeDestination(value: string | null) {
  return value === "/reset-password" ? "/reset-password" : "/";
}
