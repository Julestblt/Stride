import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function isDocumentationOnly(changedPaths: string): boolean {
  if (!changedPaths || !changedPaths.endsWith("\0")) return false;
  const paths = changedPaths.slice(0, -1).split("\0");
  return paths.every((path) => {
    if (path.split("/").some((part) => !part || part === "." || part === ".."))
      return false;
    return (
      path === "README.md" ||
      path === "AGENTS.md" ||
      (path.startsWith("docs/") && path.endsWith(".md")) ||
      path === ".github/pull_request_template.md" ||
      /^\.github\/PULL_REQUEST_TEMPLATE\/[^/]+\.md$/.test(path) ||
      /^\.github\/ISSUE_TEMPLATE\/[^/]+\.(md|yml|yaml)$/.test(path)
    );
  });
}

export function changedPathsBetween(
  base: string,
  head: string,
  cwd = process.cwd(),
): string {
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha)))
    throw new Error("CI scope requires full commit hashes.");
  return execFileSync(
    "git",
    ["diff", "--no-renames", "--name-only", "-z", base, head, "--"],
    { cwd, encoding: "utf8" },
  );
}

export type Lanes = {
  development: string[];
  course: string[];
  database: string[];
  smoke: string[];
  areas: Record<string, string[]>;
};

export type BrowserLane = {
  lane: string;
  project: string;
  shard: string;
  production: "true" | "false";
  specs: string;
};

const globalAreas = new Set(["app-shell", "data-activity", "app", "supabase"]);
const areaAliases: Record<string, string> = { plan: "plans", dev: "coach" };

function changedPathList(changedPaths: string): string[] | null {
  if (!changedPaths || !changedPaths.endsWith("\0")) return null;
  return changedPaths.slice(0, -1).split("\0");
}

export function touchesMigrations(changedPaths: string): boolean {
  const paths = changedPathList(changedPaths);
  return (
    !paths || paths.some((path) => path.startsWith("supabase/migrations/"))
  );
}

export function areaOf(path: string): string | undefined {
  const match =
    /^src\/(?:features|server)\/([\w-]+)\//.exec(path) ??
    /^src\/app\/(?:\(app\)|api)\/([\w-]+)\//.exec(path);
  if (match) return areaAliases[match[1]] ?? match[1];
  if (/^src\/app\/(?:\(auth\)|auth)\//.test(path)) return "auth";
  if (path.startsWith("src/app/settings/")) return "settings";
  if (path.startsWith("src/app/onboarding/")) return "onboarding";
  if (path.startsWith("src/app/(internal)/")) return "internal";
  if (path === "src/app/page.tsx") return "home";
  if (path === "src/app/not-found.tsx") return "not-found";
  return undefined;
}

const routeEntry =
  /^src\/(?:proxy\.ts|app\/(?:.+\/)?(?:page|layout|loading|route|error|not-found|template|default)\.tsx?)$/;

function resolveImport(
  from: string,
  specifier: string,
  sources: Map<string, string>,
): string | undefined {
  const base = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? posix.join(posix.dirname(from), specifier)
      : undefined;
  if (!base) return undefined;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ].find((candidate) => sources.has(candidate));
}

export function browserScope(
  changedPaths: string,
  lanes: Lanes,
  sources: Map<string, string>,
): "all" | string[] {
  const paths = changedPathList(changedPaths);
  if (!paths) return "all";
  const specs = new Set<string>();
  const changed: string[] = [];
  for (const path of paths) {
    if (isDocumentationOnly(`${path}\0`)) continue;
    if (
      /^(?:supabase|managed-agents|tests\/(?:unit|integration))\//.test(path) ||
      /^scripts\/supabase-[^/]+\.sh$/.test(path) ||
      path === "src/server/supabase/database.types.ts"
    )
      continue;
    const spec = /^tests\/e2e\/([\w-]+)\.spec\.ts$/.exec(path);
    if (spec) specs.add(spec[1]);
    else if (/^src\/.+\.tsx?$/.test(path)) changed.push(path);
    else return "all";
  }
  const importers = new Map<string, string[]>();
  for (const [file, content] of sources) {
    for (const [, staticSpecifier, dynamicSpecifier] of content.matchAll(
      /(?:^|;|\n)\s*(?!import\s+type\b|export\s+type\b)(?:import|export)\b[^;"']*?(?:from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g,
    )) {
      const target = resolveImport(
        file,
        staticSpecifier ?? dynamicSpecifier,
        sources,
      );
      if (target)
        importers.set(target, [...(importers.get(target) ?? []), file]);
    }
  }
  const areas = new Set<string>();
  for (const file of changed) {
    const reached = new Set([file]);
    const pending = [file];
    const entries: string[] = [];
    while (pending.length) {
      const current = pending.pop() ?? "";
      if (routeEntry.test(current)) entries.push(current);
      for (const importer of importers.get(current) ?? []) {
        if (reached.has(importer)) continue;
        reached.add(importer);
        pending.push(importer);
      }
    }
    for (const owner of entries.length ? entries : [file]) {
      const area = areaOf(owner);
      if (!area || globalAreas.has(area)) return "all";
      areas.add(area);
    }
  }
  for (const area of areas) {
    const mapped = lanes.areas[area];
    if (!mapped) return "all";
    for (const spec of mapped) specs.add(spec);
  }
  if (specs.size) for (const spec of lanes.smoke) specs.add(spec);
  return [...specs].filter((spec) => !lanes.database.includes(spec)).sort();
}

export function browserMatrix(
  scope: "all" | string[],
  lanes: Lanes,
  available: string[],
): BrowserLane[] {
  const selected = (
    scope === "all"
      ? available
      : scope.filter((spec) => available.includes(spec))
  ).filter((spec) => !lanes.database.includes(spec));
  const files = (specs: string[]) =>
    scope === "all"
      ? ""
      : specs.map((spec) => `tests/e2e/${spec}.spec.ts`).join(" ");
  const development = selected.filter((spec) =>
    lanes.development.includes(spec),
  );
  const course = selected.filter((spec) => lanes.course.includes(spec));
  const main = selected.filter(
    (spec) => !development.includes(spec) && !course.includes(spec),
  );
  const shards = scope === "all" || main.length > 8 ? 2 : 1;
  const developmentShards = scope === "all" ? 2 : 1;
  return [
    ...(main.length
      ? Array.from({ length: shards }, (_, index) => ({
          lane: `main-${index + 1}`,
          project: "chromium",
          shard: `${index + 1}/${shards}`,
          production: "true" as const,
          specs: files(main),
        }))
      : []),
    ...(course.length
      ? [
          {
            lane: "course",
            project: "chromium-race-course",
            shard: "1/1",
            production: "true" as const,
            specs: files(course),
          },
        ]
      : []),
    ...(development.length
      ? Array.from({ length: developmentShards }, (_, index) => ({
          lane: `development-${index + 1}`,
          project: "chromium-development",
          shard: `${index + 1}/${developmentShards}`,
          production: "false" as const,
          specs: files(development),
        }))
      : []),
  ];
}

function readSources(cwd = process.cwd()): Map<string, string> {
  const files = execFileSync("git", ["ls-files", "-z", "src"], {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => /\.tsx?$/.test(file));
  return new Map(
    files.map((file) => [file, readFileSync(join(cwd, file), "utf8")]),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const pullRequest = process.env.CI_EVENT_NAME === "pull_request";
  let changedPaths: string | undefined;
  try {
    changedPaths = changedPathsBetween(
      process.env.CI_BASE_SHA ?? "",
      process.env.CI_HEAD_SHA ?? "",
    );
  } catch {
    process.stderr.write("Scope detection failed; running full CI.\n");
  }
  const lanes: Lanes = JSON.parse(
    readFileSync(join(process.cwd(), "tests/e2e/lanes.json"), "utf8"),
  );
  const available = readdirSync(join(process.cwd(), "tests/e2e"))
    .filter((file) => file.endsWith(".spec.ts"))
    .map((file) => file.slice(0, -".spec.ts".length));
  const documentationOnly =
    pullRequest &&
    changedPaths !== undefined &&
    isDocumentationOnly(changedPaths);
  const scope =
    pullRequest && changedPaths !== undefined
      ? browserScope(changedPaths, lanes, readSources())
      : "all";
  const matrix = documentationOnly
    ? []
    : browserMatrix(scope, lanes, available);
  const output = [
    `documentation_only=${documentationOnly}`,
    `migrations=${changedPaths === undefined || touchesMigrations(changedPaths)}`,
    `browser=${matrix.length > 0}`,
    `browser_matrix=${JSON.stringify({ include: matrix })}`,
    "",
  ].join("\n");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
