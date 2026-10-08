import { describe, expect, it } from "vitest";
import { cn } from "../../src/lib/utils";

describe("class merging with Night Track tokens", () => {
  it("keeps a Stride type size next to a text colour", () => {
    expect(cn("text-nano text-muted-foreground")).toBe(
      "text-nano text-muted-foreground",
    );
    expect(cn("text-metric", "text-warning")).toBe("text-metric text-warning");
  });

  it("lets a later Stride size or radius override an earlier one", () => {
    expect(cn("text-body", "text-sm")).toBe("text-sm");
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
    expect(cn("rounded-control", "rounded-surface")).toBe("rounded-surface");
    expect(cn("rounded-panel", "rounded-none")).toBe("rounded-none");
  });
});
