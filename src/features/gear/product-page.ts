import {
  specSourceFields,
  shoeCategories,
  shoePlates,
  shoeTerrains,
  type ShoeCategory,
  type ShoePlate,
  type ShoeTerrain,
} from "./model";

export const pageFields = specSourceFields;

export type PageField = (typeof pageFields)[number];

export type PageSpec = {
  brand?: string;
  model?: string;
  version?: string;
  category?: ShoeCategory;
  terrain?: ShoeTerrain;
  foam?: string;
  stackHeelMm?: number;
  stackForefootMm?: number;
  dropMm?: number;
  weightG?: number;
  plate?: ShoePlate;
  lugDepthMm?: number;
};

const maximumCharacters = 24_000;

export type UrlCheck =
  { ok: true; url: URL } | { ok: false; reason: "invalid" | "blocked" };

const privateIpv4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^(22[4-9]|2[3-5]\d)\./,
];

export function isPublicAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value.includes(":")) {
    if (value === "::" || value === "::1") return false;
    if (/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(value)) return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
    return mapped ? isPublicAddress(mapped[1]) : true;
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(value)) return false;
  return !privateIpv4.some((pattern) => pattern.test(value));
}

export function checkProductUrl(text: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "https:" || url.username || url.password)
    return { ok: false, reason: "invalid" };
  if (url.port && url.port !== "443") return { ok: false, reason: "blocked" };
  const host = url.hostname.toLowerCase();
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".ts.net")
  )
    return { ok: false, reason: "blocked" };
  if (/^[\d.]+$/.test(host) || host.startsWith("["))
    return isPublicAddress(host)
      ? { ok: true, url }
      : { ok: false, reason: "blocked" };
  return { ok: true, url };
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  ocirc: "ô",
  deg: "°",
};

function decode(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x"))
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#"))
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return entities[code.toLowerCase()] ?? match;
  });
}

function squash(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const specWords =
  /\b(drop|offset|poids|weight|stack|hauteur|talon|heel|avant-pied|forefoot|crampons?|lugs?|mousse|foam|midsole|semelle|plaque|plate|carbone?|carbon|amorti|cushion)/i;
const specBudget = 6000;
const structuredBudget = 3000;

function specPassages(lines: string[]) {
  const picked: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (line.length > 300 || !specWords.test(line)) continue;
    if (size + line.length > specBudget) break;
    picked.push(line);
    size += line.length + 1;
  }
  return picked;
}

export function pageText(html: string) {
  const structured = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map((match) => squash(match[1]))
    .join(" ")
    .slice(0, structuredBudget);
  const meta = [
    ...html.matchAll(
      /<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description)["'][^>]*>/gi,
    ),
  ]
    .map((match) => /content=["']([^"']*)["']/i.exec(match[0])?.[1] ?? "")
    .filter(Boolean);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const lines = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dt|dd|td|th|span)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map(squash)
    .filter(Boolean);
  return squash(
    [
      decode(title),
      ...meta.map(decode),
      ...specPassages(lines),
      ...lines,
      decode(structured),
    ].join("\n"),
  ).slice(0, maximumCharacters);
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function numberIn(evidence: string, value: number) {
  const numbers = [...evidence.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    Number(match[0].replace(",", ".")),
  );
  return numbers.some((number) => Math.abs(number - value) < 0.051);
}

type Candidate = { value?: unknown; evidence?: unknown };

const textLimits: Partial<Record<PageField, number>> = {
  brand: 60,
  model: 80,
  version: 20,
  foam: 60,
};

const numberLimits: Partial<Record<PageField, [number, number]>> = {
  stackHeelMm: [5, 60],
  stackForefootMm: [5, 60],
  dropMm: [0, 20],
  weightG: [80, 600],
  lugDepthMm: [0, 10],
};

const enums: Partial<Record<PageField, readonly string[]>> = {
  category: shoeCategories,
  terrain: shoeTerrains,
  plate: shoePlates,
};

export function groundedSpec(raw: unknown, text: string): PageSpec {
  const fields =
    raw && typeof raw === "object" && "fields" in raw
      ? (raw as { fields: unknown }).fields
      : null;
  if (!fields || typeof fields !== "object") return {};
  const page = normalize(text);
  const result: Record<string, string | number> = {};
  for (const key of pageFields) {
    const candidate = (fields as Record<string, Candidate | undefined>)[key];
    if (!candidate || typeof candidate !== "object") continue;
    const { value, evidence } = candidate;
    if (typeof evidence !== "string" || evidence.trim().length < 2) continue;
    const quoted = normalize(evidence);
    if (!page.includes(quoted)) continue;
    const limit = textLimits[key];
    const range = numberLimits[key];
    const options = enums[key];
    if (limit !== undefined) {
      if (typeof value !== "string") continue;
      const clean = squash(value);
      if (!clean || clean.length > limit) continue;
      if (!quoted.includes(normalize(clean))) continue;
      result[key] = clean;
    } else if (range !== undefined) {
      const number = typeof value === "number" ? value : Number.NaN;
      if (!Number.isFinite(number) || number < range[0] || number > range[1])
        continue;
      if (!numberIn(evidence, number)) continue;
      result[key] = key === "weightG" ? Math.round(number) : number;
    } else if (options !== undefined) {
      if (typeof value !== "string" || !options.includes(value)) continue;
      result[key] = value;
    }
  }
  return result as PageSpec;
}
