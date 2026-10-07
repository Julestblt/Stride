import { expect, test } from "@playwright/test";

test("the Stride foundation page presents the product clearly", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Stride/);
  await expect(
    page.getByRole("heading", { name: /Your running, with context\./ }),
  ).toBeVisible();
  await expect(page.getByText("Road and trail, in one stride.")).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`the foundation stays readable and keyboard accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    const home = page.getByRole("link", { name: "Stride home" });
    await expect(home).toBeFocused();
    await expect(home).toHaveCSS("outline-style", "solid");
    await expect(home).toHaveCSS("outline-width", "2px");
  });
}

test("Night Track utilities and global accessibility defaults resolve in the browser", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const surface = document.createElement("div");
    surface.id = "theme-probe";
    surface.className =
      "bg-surface text-muted font-metric rounded-surface border border-border";
    document.body.append(surface);
    const input = document.createElement("input");
    input.id = "state-probe";
    input.className =
      "bg-surface-inset text-foreground font-mono rounded-control border border-border";
    input.setAttribute("aria-invalid", "true");
    input.disabled = true;
    document.body.append(input);
    const raised = document.createElement("div");
    raised.id = "raised-probe";
    raised.className =
      "bg-surface-raised text-muted-foreground outline-focus motion-safe:animate-pulse";
    document.body.append(raised);
  });
  const surface = page.locator("#theme-probe");
  await expect(surface).toHaveCSS("background-color", "rgb(19, 20, 17)");
  await expect(surface).toHaveCSS("color", "rgb(179, 178, 170)");
  await expect(surface).toHaveCSS("border-color", "rgb(38, 39, 34)");
  await expect(surface).toHaveCSS("border-radius", "8px");
  await expect(surface).toHaveCSS("font-family", /Barlow/);
  const input = page.locator("#state-probe");
  await expect(input).toHaveCSS("background-color", "rgb(12, 13, 11)");
  await expect(input).toHaveCSS("color", "rgb(237, 236, 230)");
  await expect(input).toHaveCSS("border-color", "rgb(255, 106, 61)");
  await expect(input).toHaveCSS("border-radius", "6px");
  await expect(input).toHaveCSS("font-family", /IBM/);
  await expect(input).toHaveCSS("opacity", "0.5");
  const raised = page.locator("#raised-probe");
  await expect(raised).toHaveCSS("background-color", "rgb(26, 27, 24)");
  await expect(raised).toHaveCSS("color", "rgb(138, 137, 129)");
  await expect(raised).toHaveCSS("outline-color", "rgb(213, 255, 63)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(raised).toHaveCSS("animation-name", "none");
});
