import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
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

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let documentationOnly = false;
  if (process.env.CI_EVENT_NAME === "pull_request") {
    try {
      documentationOnly = isDocumentationOnly(
        changedPathsBetween(
          process.env.CI_BASE_SHA ?? "",
          process.env.CI_HEAD_SHA ?? "",
        ),
      );
    } catch {
      process.stderr.write("Scope detection failed; running full CI.\n");
    }
  }
  const output = `documentation_only=${documentationOnly}\n`;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
