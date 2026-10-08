import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { passwordPolicy } from "../../src/features/auth/password-policy";
import { signUpSchema } from "../../src/features/auth/schemas";
import {
  authenticate,
  changePassword,
  requestEmail,
} from "../../src/server/auth/service";
import {
  parseSiteUrl,
  safeDestination,
} from "../../src/server/auth/environment";
import { authCookieOptions } from "../../src/server/supabase/cookie-policy";

const provider = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

function data(values: Record<string, string>) {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

const credentials = {
  email: "runner@example.com",
  password: "a-quiet-trail-at-dawn",
  confirmation: "a-quiet-trail-at-dawn",
};

beforeEach(() => vi.resetAllMocks());

describe("password policy", () => {
  it("starts with no claimed strength", () =>
    expect(passwordPolicy("").strength).toBe(""));
  it("rejects short, common, repeated and email-derived passwords", () => {
    for (const password of [
      "short",
      "password123",
      "1111111111",
      "runner123456789",
    ])
      expect(passwordPolicy(password, "runner@example.com").valid).toBe(false);
  });
  it("accepts long passphrases and rejects mismatched confirmation", () => {
    expect(passwordPolicy(credentials.password, credentials.email).valid).toBe(
      true,
    );
    expect(
      signUpSchema.safeParse({ ...credentials, confirmation: "different" })
        .success,
    ).toBe(false);
  });
});

describe("provider outcomes", () => {
  it("never calls the provider for invalid credentials or mismatched signup", async () => {
    expect(
      (
        await authenticate(
          provider,
          "sign-in",
          data({ email: "bad", password: "" }),
        )
      ).status,
    ).toBe("error");
    expect(
      (
        await authenticate(
          provider,
          "sign-up",
          data({ ...credentials, confirmation: "wrong" }),
        )
      ).status,
    ).toBe("error");
    expect(provider.signInWithPassword).not.toHaveBeenCalled();
    expect(provider.signUp).not.toHaveBeenCalled();
  });
  it("only authenticates when signup returns a real session", async () => {
    provider.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(
      (await authenticate(provider, "sign-up", data(credentials))).status,
    ).toBe("success");
    provider.signUp.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    });
    expect(
      (await authenticate(provider, "sign-up", data(credentials))).status,
    ).toBe("authenticated");
  });
  it("hides provider errors and never returns passwords", async () => {
    provider.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "private provider detail" },
    });
    const result = await authenticate(provider, "sign-in", data(credentials));
    expect(result.status).toBe("error");
    expect(result.email).toBe(credentials.email);
    expect(JSON.stringify(result)).not.toContain("private provider detail");
    expect(JSON.stringify(result)).not.toContain(credentials.password);
  });
  it("magic links cannot create accounts and report success only after response", async () => {
    provider.signInWithOtp.mockResolvedValue({ error: null });
    const result = await requestEmail(
      provider,
      "magic",
      data({ email: credentials.email }),
      "http://localhost:3000/auth/callback",
    );
    expect(result.status).toBe("success");
    expect(result.sentAt).toBeTypeOf("number");
    expect(provider.signInWithOtp).toHaveBeenCalledWith({
      email: credentials.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  });
  it("handles recovery rejection and network failures without an inbox success", async () => {
    provider.resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit" },
    });
    expect(
      (
        await requestEmail(
          provider,
          "recovery",
          data({ email: credentials.email }),
          "http://localhost:3000/auth/callback",
        )
      ).status,
    ).toBe("error");
    provider.resetPasswordForEmail.mockRejectedValue(new Error("private"));
    expect(
      (
        await requestEmail(
          provider,
          "recovery",
          data({ email: credentials.email }),
          "http://localhost:3000/auth/callback",
        )
      ).sentAt,
    ).toBeUndefined();
  });
  it("rejects invalid email before requesting a link", async () => {
    expect(
      (
        await requestEmail(
          provider,
          "recovery",
          data({ email: "not-email" }),
          "http://localhost:3000/auth/callback",
        )
      ).status,
    ).toBe("error");
    expect(provider.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("password reset authorization", () => {
  it("does not update without a verified current user", async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await changePassword(provider, data(credentials))).status).toBe(
      "error",
    );
    expect(provider.updateUser).not.toHaveBeenCalled();
    provider.getUser.mockResolvedValue({
      data: { user: { email: credentials.email } },
      error: null,
    });
    expect((await changePassword(provider, data(credentials))).status).toBe(
      "error",
    );
    expect(provider.updateUser).not.toHaveBeenCalled();
  });
  it("updates and revokes only other sessions", async () => {
    provider.getUser.mockResolvedValue({
      data: {
        user: { email: credentials.email, email_confirmed_at: "2026-10-08" },
      },
      error: null,
    });
    provider.updateUser.mockResolvedValue({ error: null });
    provider.signOut.mockResolvedValue({ error: null });
    expect((await changePassword(provider, data(credentials))).status).toBe(
      "authenticated",
    );
    expect(provider.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
  it("honestly reports saved password when session revocation throws", async () => {
    provider.getUser.mockResolvedValue({
      data: {
        user: { email: credentials.email, email_confirmed_at: "2026-10-08" },
      },
      error: null,
    });
    provider.updateUser.mockResolvedValue({ error: null });
    provider.signOut.mockRejectedValue(new Error("offline"));
    const result = await changePassword(provider, data(credentials));
    expect(result.status).toBe("success");
    expect(result.message).toContain("password was saved");
  });
});

describe("callback origin and destinations", () => {
  it("allows only the two local success destinations", () => {
    for (const value of [
      null,
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/reset-password?next=https://evil.example",
      "/other",
    ])
      expect(safeDestination(value)).toBe("/");
    expect(safeDestination("/reset-password")).toBe("/reset-password");
  });
  it("validates trusted origin rather than accepting credentials, paths or remote HTTP", () => {
    expect(parseSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(parseSiteUrl("https://stride.example")).toBe(
      "https://stride.example",
    );
    for (const value of [
      undefined,
      "http://stride.example",
      "https://user:secret@stride.example",
      "https://stride.example/path",
      "https://stride.example?next=evil",
      "javascript:alert(1)",
    ])
      expect(() => parseSiteUrl(value)).toThrow();
  });
});

describe("session cookie persistence", () => {
  it("removes persistence for session cookies and retains security flags", () => {
    const result = authCookieOptions(
      { maxAge: 123, expires: new Date(), httpOnly: false, sameSite: "none" },
      false,
      true,
    );
    expect(result.maxAge).toBeUndefined();
    expect(result.expires).toBeUndefined();
    expect(result).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });
  it("keeps persistent expiry and deletion semantics", () => {
    expect(authCookieOptions({ maxAge: 123 }, true, false).maxAge).toBe(123);
    expect(authCookieOptions({ maxAge: 0 }, false, false).maxAge).toBe(0);
  });
});
