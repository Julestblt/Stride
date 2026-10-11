import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { get as httpsGet } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { buildCourse } from "@/features/races/course";
import { decodeXml, parseGpx } from "@/features/races/gpx";
import {
  acceptRoadbook,
  reviewAgainstGpx,
  roadbookLines,
  type RoadbookPoint,
} from "@/features/races/roadbook";
import { clockToSql } from "@/features/races/format";
import { aiConfigured } from "@/server/ai/provider";
import { extractRoadbookWithAi } from "@/server/ai/skills/roadbook-extraction";
import type { OnboardingContext } from "@/server/onboarding/context";
import { maximumUploadBytes, storeCourse } from "./course";

export type RoadbookResult =
  | {
      status: "roadbook-saved";
      points: number;
      cutoffs: number;
      review: string[];
    }
  | { status: "course-saved" }
  | {
      status:
        | "no-course"
        | "nothing-found"
        | "invalid-file"
        | "invalid-link"
        | "unreachable"
        | "too-large"
        | "missing"
        | "error";
    };

const fetchTimeoutMs = 10_000;
const maximumRedirects = 3;

async function pdfLines(bytes: Uint8Array) {
  const { extractTextItems } = await import("unpdf");
  const { items } = await extractTextItems(bytes);
  return items
    .flatMap((page) => {
      const rows = new Map<number, { x: number; text: string }[]>();
      for (const item of page) {
        if (!item.str.trim()) continue;
        const key = Math.round(item.y / 3);
        rows.set(key, [
          ...(rows.get(key) ?? []),
          { x: item.x, text: item.str },
        ]);
      }
      return [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, cells]) =>
          cells
            .sort((a, b) => a.x - b.x)
            .map((cell) => cell.text.trim())
            .join(" "),
        );
    })
    .join("\n");
}

function privateAddress(address: string) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) return true;
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function safeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    return url;
  } catch {
    return null;
  }
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = addresses as LookupAddress[];
    const allowed = list.filter(({ address }) => !privateAddress(address));
    if (allowed.length === 0 || allowed.length !== list.length)
      return callback(new Error("Blocked address"), "", 4);
    if (options.all) return callback(null, allowed as unknown as string, 4);
    callback(null, allowed[0].address, allowed[0].family);
  });
};

type Remote =
  | { status: "ok"; bytes: Uint8Array; url: URL }
  | { status: "unreachable" | "too-large" | "invalid-link" };

function download(
  url: URL,
): Promise<Remote | { status: "redirect"; location: string }> {
  return new Promise((resolve) => {
    if (isIP(url.hostname.replace(/^\[|\]$/g, "")))
      return resolve({ status: "invalid-link" });
    const request = httpsGet(
      url,
      {
        lookup: guardedLookup,
        timeout: fetchTimeoutMs,
        headers: {
          "User-Agent": "Stride/0.1",
          Accept:
            "application/gpx+xml, application/pdf, text/html;q=0.9, */*;q=0.5",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({
            status: "redirect",
            location: response.headers.location,
          });
        }
        if (status < 200 || status >= 300) {
          response.resume();
          return resolve({ status: "unreachable" });
        }
        if (
          Number(response.headers["content-length"] ?? 0) > maximumUploadBytes
        ) {
          response.destroy();
          return resolve({ status: "too-large" });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maximumUploadBytes) {
            response.destroy();
            resolve({ status: "too-large" });
          } else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: "ok",
            bytes: new Uint8Array(Buffer.concat(chunks)),
            url,
          }),
        );
        response.on("error", () => resolve({ status: "unreachable" }));
      },
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve({ status: "unreachable" }));
  });
}

async function fetchRemote(raw: string): Promise<Remote> {
  let target = safeUrl(raw);
  for (let hop = 0; target && hop <= maximumRedirects; hop += 1) {
    const result = await download(target);
    if (result.status !== "redirect") return result;
    target = safeUrl(new URL(result.location, target).toString());
  }
  return { status: "invalid-link" };
}

function isPdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

function htmlText(html: string) {
  return decodeXml(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function gpxLink(html: string, base: URL) {
  const match = /href\s*=\s*["']([^"']+\.gpx(?:\?[^"']*)?)["']/i.exec(html);
  if (!match) return null;
  try {
    return new URL(decodeXml(match[1]), base).toString();
  } catch {
    return null;
  }
}

async function readCourseDistance(context: OnboardingContext, raceId: string) {
  const { data, error } = await context.client
    .from("race_courses")
    .select("distance_m")
    .eq("user_id", context.userId)
    .eq("race_id", raceId)
    .maybeSingle();
  if (error) throw new Error("Unable to read course");
  return data ? Number(data.distance_m) : null;
}

async function storeRoadbook(
  context: OnboardingContext,
  raceId: string,
  points: RoadbookPoint[],
  source: string,
): Promise<RoadbookResult> {
  const existing = await context.client
    .from("race_waypoints")
    .select("name, distance_m")
    .eq("user_id", context.userId)
    .eq("race_id", raceId)
    .eq("source", "gpx");
  if (existing.error) return { status: "error" };
  const reviewed = reviewAgainstGpx(
    points,
    (existing.data ?? []).map((row) => ({
      name: row.name,
      distanceM: Number(row.distance_m),
    })),
  );
  const summary = {
    source: source.slice(0, 200),
    importedAt: new Date().toISOString(),
    points: reviewed.length,
    cutoffs: reviewed.filter((point) => point.cutoffMinutes !== null).length,
    review: reviewed
      .filter((point) => point.needsReview)
      .map((point) => point.name)
      .slice(0, 50),
  };
  const { error } = await context.client.rpc("replace_race_roadbook", {
    p_race_id: raceId,
    p_points: reviewed.map((point) => ({
      kind: point.kind,
      name: point.name,
      distance_m: point.distanceM,
      cutoff_time:
        point.cutoffMinutes === null ? null : clockToSql(point.cutoffMinutes),
      services: point.services,
      needs_review: point.needsReview,
    })),
    p_summary: summary,
  });
  if (error) return { status: "error" };
  return {
    status: "roadbook-saved",
    points: summary.points,
    cutoffs: summary.cutoffs,
    review: summary.review,
  };
}

async function roadbookFromText(
  context: OnboardingContext,
  raceId: string,
  text: string,
  source: string,
): Promise<RoadbookResult> {
  const distance = await readCourseDistance(context, raceId);
  if (distance === null) return { status: "no-course" };
  const candidates =
    (aiConfigured() ? await extractRoadbookWithAi(text) : null) ??
    roadbookLines(text);
  const points = acceptRoadbook(candidates, text, distance);
  if (points.length === 0) return { status: "nothing-found" };
  return storeRoadbook(context, raceId, points, source);
}

export async function importRoadbookFile(
  context: OnboardingContext,
  raceId: string,
  file: File,
): Promise<RoadbookResult> {
  if (file.size > maximumUploadBytes) return { status: "too-large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { status: "invalid-file" };
  const text = await pdfLines(bytes).catch(() => null);
  if (!text) return { status: "invalid-file" };
  return roadbookFromText(context, raceId, text, file.name || "roadbook.pdf");
}

async function courseFromBytes(
  context: OnboardingContext,
  raceId: string,
  bytes: Uint8Array,
  name: string,
): Promise<RoadbookResult | null> {
  const parsed = parseGpx(new TextDecoder().decode(bytes));
  if (typeof parsed === "string") return null;
  const course = buildCourse(parsed.points);
  if (!course) return { status: "nothing-found" };
  const result = await storeCourse(
    context,
    raceId,
    course,
    { kind: "gpx", fileName: name },
    parsed.waypoints,
  );
  return result.status === "saved"
    ? { status: "course-saved" }
    : { status: result.status === "missing" ? "missing" : "error" };
}

export async function importLink(
  context: OnboardingContext,
  raceId: string,
  link: string,
  intent: "course" | "roadbook",
): Promise<RoadbookResult> {
  const remote = await fetchRemote(link);
  if (remote.status !== "ok") return { status: remote.status };
  const name = decodeURIComponent(
    remote.url.pathname.split("/").pop() || remote.url.hostname,
  ).slice(0, 200);
  if (isPdf(remote.bytes)) {
    const text = await pdfLines(remote.bytes).catch(() => null);
    return text
      ? roadbookFromText(context, raceId, text, name)
      : { status: "invalid-file" };
  }
  const asCourse = await courseFromBytes(context, raceId, remote.bytes, name);
  if (asCourse) return asCourse;
  const html = new TextDecoder().decode(remote.bytes);
  const linked = gpxLink(html, remote.url);
  if (linked && intent === "course") {
    const gpx = await fetchRemote(linked);
    if (gpx.status === "ok") {
      const saved = await courseFromBytes(
        context,
        raceId,
        gpx.bytes,
        decodeURIComponent(gpx.url.pathname.split("/").pop() || "parcours.gpx"),
      );
      if (saved) return saved;
    }
  }
  return roadbookFromText(context, raceId, htmlText(html), remote.url.hostname);
}
