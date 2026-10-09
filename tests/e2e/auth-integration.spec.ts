import { expect, test } from "@playwright/test";

for (const remember of [true, false]) {
  test(`password sign-in preserves ${remember ? "persistent" : "session"} cookies`, async ({
    page,
    context,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
    await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
    if (!remember) await page.getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/");
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.includes("auth-token"),
    );
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
      expect(remember ? cookie.expires > 0 : cookie.expires === -1).toBe(true);
    }
  });
}

test("rejected credentials give safe feedback", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Unable to sign in.", { exact: false }),
  ).toBeVisible();
});

test("signup requiring confirmation shows inbox feedback", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Jules Thibault");
  await page
    .getByLabel("Email", { exact: true })
    .fill("confirmation@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/sign-up");
  await expect(
    page.getByRole("button", { name: "Resend email" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
});

test("unconfirmed sign-in resends a confirmation link", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Email", { exact: true })
    .fill("confirmation@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Confirm your email to continue")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resend email" }),
  ).toBeDisabled();
  const events = await (
    await request.get("http://127.0.0.1:3200/__test__/events")
  ).json();
  expect(
    events.some((event: { path: string }) => event.path === "/auth/v1/resend"),
  ).toBe(true);
});

test("confirmed signup link reaches the confirmed page", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=valid-token&type=signup&next=/email-confirmed",
  );
  await expect(page).toHaveURL("/email-confirmed");
  await expect(
    page.getByRole("heading", { name: "You're in, Jules." }),
  ).toBeVisible();
});

test("signup token links without a next parameter reach confirmation", async ({
  page,
}) => {
  await page.goto("/auth/callback?token_hash=valid-token&type=signup");
  await expect(page).toHaveURL("/email-confirmed");
});

test("expired signup link offers a replacement", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=expired-token&type=signup&next=/email-confirmed",
  );
  await expect(page).toHaveURL("/link-expired");
  await expect(
    page.getByRole("heading", { name: "This link is no longer valid" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill("confirmation@example.com");
  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect(
    page.getByText("If this address needs confirmation", { exact: false }),
  ).toBeVisible();
});

test("recovery reports the first provider failure", async ({ page }) => {
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email", { exact: true })
    .fill("unavailable@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText("We couldn't request a link.", { exact: false }),
  ).toBeVisible();
});

test("recovery exchanges a code, saves a password and revokes other sessions", async ({
  page,
  request,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  const link = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=athlete@example.com",
    )
  ).json();
  await page.goto(link.url);
  await expect(page).toHaveURL("/reset-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("LongTrailAtSunrise2026!");
  await page
    .getByLabel("Confirm", { exact: true })
    .fill("LongTrailAtSunrise2026!");
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page).toHaveURL("/");
  const events = await (
    await request.get("http://127.0.0.1:3200/__test__/events")
  ).json();
  expect(events).toContainEqual(
    expect.objectContaining({ method: "PUT", path: "/auth/v1/user" }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ path: "/auth/v1/logout", scope: "others" }),
  );
});

test("verified token hash cannot redirect off site", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=valid-token&type=magiclink&next=https://evil.example",
  );
  await expect(page).toHaveURL("/");
});

for (const remember of [true, false]) {
  test(`magic link and token refresh preserve ${remember ? "persistent" : "session"} cookies`, async ({
    page,
    context,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/sign-in");
    await page
      .getByLabel("Email", { exact: true })
      .fill(
        remember ? "magic-persistent@example.com" : "magic-session@example.com",
      );
    if (!remember) await page.getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(
      page.getByText("If this email can receive a link", { exact: false }),
    ).toBeVisible();
    const link = await (
      await request.get(
        `http://127.0.0.1:3200/__test__/link?email=${remember ? "magic-persistent@example.com" : "magic-session@example.com"}`,
      )
    ).json();
    await page.goto(link.url);
    await expect(page).toHaveURL("/");
    const cookie = (await context.cookies()).find((item) =>
      item.name.endsWith("auth-token"),
    );
    expect(cookie).toBeDefined();
    expect(remember ? cookie!.expires > 0 : cookie!.expires === -1).toBe(true);
    const expired = await (
      await request.get("http://127.0.0.1:3200/__test__/expired-session")
    ).json();
    await context.addCookies([
      {
        ...cookie!,
        value: `base64-${Buffer.from(JSON.stringify(expired)).toString("base64url")}`,
      },
    ]);
    const response = await page.goto("/reset-password");
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toBeVisible();
    expect(response?.headers()["cache-control"]).toContain("no-store");
    const refreshed = (await context.cookies()).find((item) =>
      item.name.endsWith("auth-token"),
    );
    expect(refreshed?.value).not.toContain(
      Buffer.from(JSON.stringify(expired)).toString("base64url"),
    );
    expect(remember ? refreshed!.expires > 0 : refreshed!.expires === -1).toBe(
      true,
    );
    expect(refreshed?.httpOnly).toBe(true);
    const events = await (
      await request.get("http://127.0.0.1:3200/__test__/events")
    ).json();
    expect(events).toContainEqual(
      expect.objectContaining({
        grant: "refresh_token",
        path: "/auth/v1/token",
      }),
    );
    expect(errors).toEqual([]);
  });
}

test("overlapping recovery requests retain the earlier link verifier", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("earlier@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  const earlier = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=earlier@example.com",
    )
  ).json();
  await page.getByRole("button", { name: "Use a different email" }).click();
  await page.getByLabel("Email", { exact: true }).fill("later@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  await page.goto(earlier.url);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  const isolated = await context.browser()!.newContext();
  const anonymous = await isolated.newPage();
  const later = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=later@example.com",
    )
  ).json();
  await anonymous.goto(later.url);
  await expect(anonymous).toHaveURL(/\/sign-in\?error=link&reason=verifier$/);
  await isolated.close();
});

test("failed resend keeps the accepted inbox state", async ({ page }) => {
  await page.clock.install();
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email", { exact: true })
    .fill("resend-failure@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Resend reset link" }).click();
  await expect(
    page.getByText("We couldn't request a link.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("resend-failure@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
});

test("signup with a provider session returns to Stride", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Jules Thibault");
  await page
    .getByLabel("Email", { exact: true })
    .fill("new-account@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL("/");
});
