import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  changedPathsBetween,
  isDocumentationOnly,
} from "../../scripts/ci-scope";

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
});
