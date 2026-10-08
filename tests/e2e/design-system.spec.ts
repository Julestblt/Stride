import { expect, test } from "@playwright/test";

test("choice groups are keyboard operable and expose their state", async ({
  page,
}) => {
  await page.goto("/design-system");
  const surface = page.getByRole("radiogroup", { name: "Mostly…" });
  const trail = surface.getByRole("radio", { name: "Trail" });
  await expect(trail).toHaveAttribute("aria-checked", "true");
  await trail.focus();
  await page.keyboard.press("ArrowRight");
  const both = surface.getByRole("radio", { name: "Both equally" });
  await expect(both).toBeFocused();
  await page.keyboard.press("Space");
  await expect(both).toHaveAttribute("aria-checked", "true");
  await expect(trail).toHaveAttribute("aria-checked", "false");

  const monday = page.getByRole("button", { name: "Monday" });
  await expect(monday).toHaveAttribute("aria-pressed", "false");
  await monday.click();
  await expect(monday).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Track", exact: true }),
  ).toBeDisabled();
});

test("a provider value becomes the athlete's once edited", async ({ page }) => {
  await page.goto("/design-system");
  const weight = page.getByLabel("Weight", { exact: true });
  await expect(weight).toHaveValue("68");
  await expect(weight).toHaveAccessibleDescription("From Garmin · 3 days ago");
  const frame = page.locator('[data-slot="input-group"]').filter({
    has: weight,
  });
  await expect(frame).toHaveCSS("border-top-style", "dashed");
  await weight.fill("67.5");
  await expect(weight).toHaveAccessibleDescription("Entered manually");
  await expect(frame).toHaveCSS("border-top-style", "solid");
});

test("tabs, menus and dialogs keep Radix keyboard behaviour", async ({
  page,
}) => {
  await page.goto("/design-system");
  const fitness = page.getByRole("tab", { name: "Fitness" });
  await fitness.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Recovery" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel")).toContainText(
    "Sleep has been short",
  );

  const trigger = page
    .locator("#overlays")
    .getByRole("button", { name: "Disconnect Garmin" });
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Disconnect Garmin?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Keep connected" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /Settings/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
});

test("status patterns announce state without relying on colour", async ({
  page,
}) => {
  await page.goto("/design-system");
  await expect(
    page.getByRole("status").filter({ hasText: "Sign-in expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Onboarding progress" }),
  ).toHaveAttribute("aria-valuetext", "Step 4 of 6");
  await expect(page.locator('li[aria-current="step"]')).toContainText(
    "About you",
  );
  await expect(
    page.getByRole("img", { name: /Session shape: .*1 block removed/ }),
  ).toBeVisible();
  await expect(page.getByText("Change from").first()).toBeAttached();
});

test("the coach reading trace resolves to a static state with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  const reading = page.locator(
    '[data-slot="coach-activity"][data-state="reading"]',
  );
  await expect(reading.locator("span[aria-hidden] > span")).toBeHidden();
  await expect(page.locator('[data-slot="recommendation"]').first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`the design system gallery fits a ${width}px viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/design-system");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("the desktop sidebar collapses to an icon rail with tooltips", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/design-system/shell");
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("button", { name: "Toggle sidebar" }).first().click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  const container = page.locator('[data-slot="sidebar-container"]');
  await expect
    .poll(async () => (await container.boundingBox())?.width)
    .toBeLessThanOrEqual(60);
  await page.getByRole("link", { name: "Coach" }).hover();
  await expect(page.getByRole("tooltip", { name: "Coach" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
});

test("mobile navigation uses a sheet and thumb-reachable tabs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-system/shell");
  const tabs = page.getByRole("navigation", { name: "Primary" });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Ask Stride" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  const sheet = page.getByRole("dialog", { name: "Navigation" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Plan" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
