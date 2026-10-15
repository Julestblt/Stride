# Design board

The approved Stride mockups live in one Claude Design board:

**https://claude.ai/artifact/4TEgmo2A4XUfJsQ4F4n6Zs**

The live board is the visual source of truth. The repository keeps no exported screenshots or HTML archives: agents read the board directly, so a mockup change needs no export.

## Reading the board

The board is a claude.ai Artifact. Agents read it with the Claude Code Artifact tool through the owner's claude.ai login. Do not use a web fetch or `curl`. Agents and tools without that access cannot read the board.

1. List the board files with the Artifact tool (`action: "list"`, `scope: "files"`, the board URL).
2. Read `project/canvas.json`. Its `boards` map gives each artboard's file, title, size (`w`, `h`), and page. Locate artboards by title, not by file name.
3. Read only the artboards the task needs (`action: "read"`, `paths: ["project/<Name>.dc.html"]`). The files are saved to the session scratchpad, outside the repository.

Each artboard is a self-contained HTML page. It carries the literal French copy, exact colors, sizes, spacing, typography, responsive rules, and accessibility hints such as `aria-hidden` and reduced-motion handling. Prefer it over a screenshot for copy and measurements.

## Artboard titles

Titles follow `<Area> · <Screen> · <State> · <Device>`, for example `Onboarding · 2c Verify code · Mobile` or `App · Plan · Détail de séance (panneau) · Desktop`. Areas are `Foundations`, `System`, `Auth`, `Onboarding`, `App`, `Race`, `Races`, and `Settings`. `Spec` artboards describe flows and state models rather than a device screen.

File names are not meaningful. Mobile artboards usually start with `M`, and suffixes such as `-6iqa` come from board copies.

Artboards on the `archive` page (`"page": "archive"` in `canvas.json`) are superseded iterations. Do not implement them unless an issue explicitly asks for it.

## Implementing from an artboard

Artboard markup is a reference, not production code. Never copy its generated HTML, inline styles, or scripts. Rebuild the screen with Stride's architecture, Tailwind, Night Track tokens, and shadcn primitives, and map raw values such as `#D5FF3F` or `8px` radii to the semantic tokens in [design-system.md](design-system.md).

Read the `Foundations · Product system` and `Foundations · Patterns` artboards with any screen artboard when a task touches visual language.

Board assets are never application assets. Do not download, transform, or commit board images or derivatives without explicit instruction.

## Visual checks

Render an artboard locally when layout, balance, or overflow matter. Use the artboard size from `canvas.json` and keep the output untracked:

```bash
npx playwright screenshot --viewport-size=<w>,<h> --wait-for-timeout=500 \
  file://<scratchpad>/project/<Name>.dc.html test-results/board/<Name>.png
```

Tall artboards are downscaled when an agent views the full image, which makes small text unreadable. For them, read the HTML for copy and measurements, and render the region you need at viewport height instead of a full-page capture.

Compare implementation screenshots at the same viewport. Keep all comparison screenshots in ignored `test-results/` or outside the repository.

## Traceability

The board changes without git history. Each read returns the board version, for example `1792096069-088c`. Record the version and the artboard titles used in the pull request that implements a screen, and in specs or design adaptations that depend on a specific state of the board.

Accepted deviations from the board stay in each spec's `design-adaptations.md`.
