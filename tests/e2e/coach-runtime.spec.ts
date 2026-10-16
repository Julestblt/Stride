import { expect, test } from "@playwright/test";

test("the coach turn API refuses anonymous requests without starting a session", async ({
  request,
}) => {
  const response = await request.post("/api/coach/turns", {
    data: { mode: "conversation", input: { kind: "message", text: "Salut" } },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ code: "session-expired" });
});
