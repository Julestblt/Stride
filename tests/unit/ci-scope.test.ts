import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  browserMatrix,
  browserScope,
  changedPathsBetween,
  isDocumentationOnly,
  touchesMigrations,
  type Lanes,
} from "../../scripts/ci-scope";

const lanes: Lanes = {
  development: ["design-system", "data-activity"],
  course: ["races-course"],
  database: ["onboarding"],
  smoke: ["auth"],
  areas: {
    races: ["races", "races-course"],
    plans: ["plan"],
    today: ["today"],
    onboarding: ["onboarding", "auth"],
  },
};

const sources = new Map([
  ["src/app/layout.tsx", 'import { Shell } from "@/features/app-shell/shell";'],
  [
    "src/features/app-shell/shell.tsx",
    'import { days } from "@/features/plans/days";',
  ],
  ["src/features/plans/days.ts", "export const days = 7;"],
  [
    "src/features/races/components/race-map.tsx",
    "export function RaceMap() {}",
  ],
  [
    "src/features/races/model.ts",
    'import type { Plan } from "@/features/plans/days";',
  ],
  [
    "src/app/(app)/races/[id]/course/page.tsx",
    'import { RaceMap } from "../../../../../features/races/components/race-map";',
  ],
  [
    "src/app/(app)/today/page.tsx",
    'import { RaceMap } from "@/features/races/components/race-map";',
  ],
  ["src/features/races/unused.ts", "export const unused = true;"],
  ["src/features/onboarding/steps.ts", "export const steps = [];"],
]);

const changes = (...paths: string[]) => `${paths.join("\0")}\0`;

describe("CI scope", () => {
  it.each([
    "docs/testing.md",
    "docs/design/runner notes.md",
    "docs/design/runner\nnotes.md",
    "README.md",
    "AGENTS.md",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE/change.md",
  ])("allows documentation path %j", (path) => {
    expect(isDocumentationOnly(`${path}\0`)).toBe(true);
  });

  it.each([
    "src/app/page.tsx",
    "scripts/ci-scope.ts",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "supabase/migrations/schema.sql",
    ".github/workflows/ci.yml",
    "docs/check.sh",
    "docs/check.ts",
    "docs/design/template.html",
    "docs/component.mdx",
    "unknown.md",
    "docs/../package.json",
    "docs//testing.md",
    "docs/",
  ])("runs full CI for executable or unknown path %j", (path) => {
    expect(isDocumentationOnly(`${path}\0`)).toBe(false);
  });

  it("runs full CI for mixed, empty or malformed changes", () => {
    expect(isDocumentationOnly("docs/testing.md\0src/app/page.tsx\0")).toBe(
      false,
    );
    expect(isDocumentationOnly("docs/testing.md\0README.md\0")).toBe(true);
    for (const paths of ["", "\0", "README.md", "README.md\0\0"])
      expect(isDocumentationOnly(paths)).toBe(false);
  });

  it("rejects revision arguments before invoking git", () => {
    expect(() => changedPathsBetween("--help", "$(touch injected)")).toThrow(
      "CI scope requires full commit hashes.",
    );
    expect(() =>
      changedPathsBetween("a".repeat(40), "b".repeat(40), "/missing"),
    ).toThrow();
  });

  it("includes deleted executable paths when files move into documentation", () => {
    const cwd = mkdtempSync(join(tmpdir(), "stride-ci-scope-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" });
    try {
      git("init", "--quiet");
      git("config", "user.name", "CI scope test");
      git("config", "user.email", "ci-scope@example.com");
      mkdirSync(join(cwd, "src"));
      writeFileSync(
        join(cwd, "src", "executable.ts"),
        "export const value = 1;\n",
      );
      git("add", ".");
      git("commit", "--quiet", "-m", "Initial executable");
      const base = git("rev-parse", "HEAD").trim();
      mkdirSync(join(cwd, "docs"));
      git("mv", "src/executable.ts", "docs/runner\nnotes.md");
      git("commit", "--quiet", "-m", "Move executable");
      const changes = changedPathsBetween(
        base,
        git("rev-parse", "HEAD").trim(),
        cwd,
      );
      expect(changes.split("\0")).toEqual([
        "docs/runner\nnotes.md",
        "src/executable.ts",
        "",
      ]);
      expect(isDocumentationOnly(changes)).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("needs the database job only when a migration changes", () => {
    expect(touchesMigrations(changes("supabase/migrations/1_add.sql"))).toBe(
      true,
    );
    expect(
      touchesMigrations(changes("supabase/tests/policies.sql", "src/a.ts")),
    ).toBe(false);
    expect(touchesMigrations("")).toBe(true);
  });

  it("selects the specs of the routes that import a changed file", () => {
    expect(
      browserScope(
        changes("src/features/races/components/race-map.tsx"),
        lanes,
        sources,
      ),
    ).toEqual(["auth", "races", "races-course", "today"]);
  });

  it("falls back to the file area when no route imports it", () => {
    expect(
      browserScope(changes("src/features/races/unused.ts"), lanes, sources),
    ).toEqual(["auth", "races", "races-course"]);
  });

  it("ignores type-only imports when following importers", () => {
    expect(
      browserScope(changes("src/features/races/model.ts"), lanes, sources),
    ).toEqual(["auth", "races", "races-course"]);
  });

  it("runs every spec when a root layout reaches the change", () => {
    expect(
      browserScope(changes("src/features/plans/days.ts"), lanes, sources),
    ).toBe("all");
  });

  it.each([
    "tests/fixtures/auth-provider.mjs",
    "package.json",
    "playwright.config.ts",
    "src/app/globals.css",
    "src/components/ui/button.tsx",
  ])("runs every spec for shared path %j", (path) => {
    expect(browserScope(changes(path), lanes, sources)).toBe("all");
  });

  it("keeps changed specs and skips paths that never reach the browser", () => {
    expect(
      browserScope(
        changes(
          "tests/e2e/races.spec.ts",
          "managed-agents/agents/coach.md",
          "supabase/migrations/1_add.sql",
          "src/server/supabase/database.types.ts",
          "tests/unit/plans.test.ts",
          "docs/testing.md",
        ),
        lanes,
        sources,
      ),
    ).toEqual(["auth", "races"]);
    expect(
      browserScope(changes("managed-agents/README.md"), lanes, sources),
    ).toEqual([]);
  });

  it("leaves database-only specs to the database job", () => {
    expect(
      browserScope(changes("src/features/onboarding/steps.ts"), lanes, sources),
    ).toEqual(["auth"]);
  });

  it("splits selected specs into their Playwright lanes", () => {
    const available = ["auth", "races", "races-course", "design-system"];
    expect(
      browserMatrix(
        ["auth", "races-course", "design-system"],
        lanes,
        available,
      ),
    ).toEqual([
      {
        lane: "main-1",
        project: "chromium",
        shard: "1/1",
        production: "true",
        specs: "tests/e2e/auth.spec.ts",
      },
      {
        lane: "course",
        project: "chromium-race-course",
        shard: "1/1",
        production: "true",
        specs: "tests/e2e/races-course.spec.ts",
      },
      {
        lane: "development-1",
        project: "chromium-development",
        shard: "1/1",
        production: "false",
        specs: "tests/e2e/design-system.spec.ts",
      },
    ]);
    expect(browserMatrix([], lanes, available)).toEqual([]);
  });

  it("shards the full suite without listing files", () => {
    expect(
      browserMatrix("all", lanes, [
        "auth",
        "races-course",
        "data-activity",
      ]).map(({ lane, shard, specs }) => [lane, shard, specs]),
    ).toEqual([
      ["main-1", "1/2", ""],
      ["main-2", "2/2", ""],
      ["course", "1/1", ""],
      ["development-1", "1/2", ""],
      ["development-2", "2/2", ""],
    ]);
  });
});
