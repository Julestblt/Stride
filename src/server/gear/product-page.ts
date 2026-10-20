import "server-only";
import { lookup } from "node:dns/promises";
import {
  checkProductUrl,
  isPublicAddress,
  pageText,
} from "@/features/gear/product-page";

export type PageFetch =
  | { ok: true; url: string; text: string }
  | { ok: false; reason: "invalid" | "blocked" | "unreachable" | "unreadable" };

const maximumBytes = 2_000_000;
const maximumRedirects = 3;
const timeoutMs = 8000;

type Resolve = (host: string) => Promise<string[]>;

const resolveHost: Resolve = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map(
    (entry) => entry.address,
  );

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(Math.min(size, maximumBytes));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk.subarray(0, bytes.length - offset), offset);
    offset += chunk.byteLength;
    if (offset >= bytes.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function fetchProductPage(
  input: string,
  {
    send = fetch,
    resolve = resolveHost,
  }: { send?: typeof fetch; resolve?: Resolve } = {},
): Promise<PageFetch> {
  let check = checkProductUrl(input);
  if (!check.ok) return { ok: false, reason: check.reason };
  for (let hop = 0; hop <= maximumRedirects; hop += 1) {
    const { url } = check;
    const addresses = await resolve(url.hostname).catch(() => []);
    if (addresses.length === 0) return { ok: false, reason: "unreachable" };
    if (!addresses.every(isPublicAddress))
      return { ok: false, reason: "blocked" };
    let response: Response;
    try {
      response = await send(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
          "User-Agent": "Mozilla/5.0 (compatible; Stride/0.1)",
        },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, reason: "unreachable" };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, reason: "unreachable" };
      check = checkProductUrl(new URL(location, url).toString());
      if (!check.ok) return { ok: false, reason: check.reason };
      continue;
    }
    if (!response.ok) return { ok: false, reason: "unreachable" };
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type))
      return { ok: false, reason: "unreadable" };
    const html = await readLimited(response).catch(() => null);
    const text = html ? pageText(html) : "";
    return text.length < 80
      ? { ok: false, reason: "unreadable" }
      : { ok: true, url: url.toString(), text };
  }
  return { ok: false, reason: "unreachable" };
}
