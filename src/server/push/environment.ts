import "server-only";
import { z } from "zod";

const pushEnvironmentSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)\S+$/),
  PUSH_DISPATCH_SECRET: z.string().min(32),
});

export type PushEnvironment = {
  publicKey: string;
  privateKey: string;
  subject: string;
  dispatchSecret: string;
};

export function pushEnvironment(): PushEnvironment | null {
  const parsed = pushEnvironmentSchema.safeParse({
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    PUSH_DISPATCH_SECRET: process.env.PUSH_DISPATCH_SECRET,
  });
  if (!parsed.success) return null;
  return {
    publicKey: parsed.data.VAPID_PUBLIC_KEY,
    privateKey: parsed.data.VAPID_PRIVATE_KEY,
    subject: parsed.data.VAPID_SUBJECT,
    dispatchSecret: parsed.data.PUSH_DISPATCH_SECRET,
  };
}
