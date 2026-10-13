import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/server/supabase/database.types";
vi.mock("server-only", () => ({}));
import { uploadProfilePhoto } from "@/server/settings/photo";

function setup() {
  const request = vi.fn(
    async () =>
      new Response(JSON.stringify({ Key: "uploaded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  return {
    request,
    context: {
      client: createClient<Database>("http://storage.fixture", "fixture-key", {
        global: { fetch: request },
        realtime: { transport: vi.fn() as unknown as typeof WebSocket },
        auth: { persistSession: false },
      }),
      userId: "11111111-1111-4111-8111-111111111111",
      email: null,
      accessToken: "fixture",
    },
  };
}
describe("profile photo upload trust boundary", () => {
  it("rejects oversized and unsupported files before storage access", async () => {
    const { request, context } = setup();
    expect(
      await uploadProfilePhoto(
        context,
        new File([Buffer.alloc(2 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toHaveProperty("error");
    expect(
      await uploadProfilePhoto(
        context,
        new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
      ),
    ).toHaveProperty("error");
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures, MIME mismatches and corrupt image data", async () => {
    const { request, context } = setup();
    expect(
      await uploadProfilePhoto(
        context,
        new File(["invalid"], "invalid.png", { type: "image/png" }),
      ),
    ).toHaveProperty("error");
    const image = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    expect(
      await uploadProfilePhoto(
        context,
        new File([Uint8Array.from(image)], "fake.jpg", { type: "image/jpeg" }),
      ),
    ).toHaveProperty("error");
    expect(
      await uploadProfilePhoto(
        context,
        new File([Uint8Array.from(image.subarray(0, 20))], "corrupt.png", {
          type: "image/png",
        }),
      ),
    ).toHaveProperty("error");
    expect(request).not.toHaveBeenCalled();
  });
  it("uploads a decoded valid image with an immutable owner-scoped path", async () => {
    const { request, context } = setup();
    const image = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const result = await uploadProfilePhoto(
      context,
      new File([Uint8Array.from(image)], "photo.png", { type: "image/png" }),
    );
    expect(result).toHaveProperty(
      "path",
      expect.stringMatching(
        /^11111111-1111-4111-8111-111111111111\/[a-f0-9-]+\.png$/,
      ),
    );
    expect(request).toHaveBeenCalledOnce();
  });
});
