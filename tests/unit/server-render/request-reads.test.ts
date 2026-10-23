import { createRequire } from "node:module";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  listActivities,
  loadHeartRateZones,
  readActivity,
  readActivityDetail,
} from "@/server/activities/activities";
import { loadWatchView } from "@/server/garmin/watch";
import { loadGear } from "@/server/gear/load";
import { readGoals } from "@/server/onboarding/goals";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview, readPlanRaces } from "@/server/plans/overview";
import { readActivePlan } from "@/server/plans/stored";
import { listRaces } from "@/server/races/races";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("react");
});

const load = createRequire(import.meta.url);
const React = load("react") as typeof import("react");
const { renderToPipeableStream } = load(
  "next/dist/compiled/react-server-dom-webpack/server.node",
) as {
  renderToPipeableStream: (
    model: unknown,
    manifest: unknown,
    options?: { onError?: (error: unknown) => void },
  ) => { pipe: (destination: Writable) => void };
};

function fakeContext() {
  const counter = { from: 0 };
  const result = { data: [], error: null, count: 0 };
  const single = { data: null, error: null };
  const builder = (): unknown =>
    new Proxy(
      {},
      {
        get(_, key) {
          if (key === "then")
            return (resolve: (value: unknown) => void) => resolve(result);
          if (key === "maybeSingle" || key === "single")
            return () => Promise.resolve(single);
          return () => builder();
        },
      },
    );
  const client = {
    from: () => {
      counter.from += 1;
      return builder();
    },
    rpc: () => builder(),
  };
  const context = {
    client,
    userId: "00000000-0000-4000-8000-000000000001",
    email: null,
    accessToken: "token",
  } as unknown as OnboardingContext;
  return { context, counter };
}

async function render(read: () => Promise<unknown>) {
  async function Probe() {
    await read();
    await read();
    return null;
  }
  const errors: unknown[] = [];
  await new Promise<void>((resolve, reject) => {
    const sink = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    sink.on("finish", resolve);
    sink.on("error", reject);
    renderToPipeableStream(React.createElement(Probe), null, {
      onError: (error) => {
        errors.push(error);
      },
    }).pipe(sink);
  });
  expect(errors).toEqual([]);
}

const now = new Date("2026-10-23T08:00:00Z");

const reads: Record<string, (context: OnboardingContext) => Promise<unknown>> =
  {
    readActivePlan: (context) => readActivePlan(context),
    readPlanRaces: (context) => readPlanRaces(context),
    readGoals: (context) => readGoals(context),
    readActivity: (context) => readActivity(context, "activity-1"),
    listActivities: (context) => listActivities(context, "all", 20, ""),
    loadHeartRateZones: (context) => loadHeartRateZones(context, now),
    loadGear: (context) => loadGear(context),
    loadWatchView: (context) => loadWatchView(context, null),
    listRaces: (context) => listRaces(context),
    loadPlanOverview: (context) => loadPlanOverview(context),
    readActivityDetail: (context) => readActivityDetail(context, "activity-1"),
  };

describe("request-scoped server reads", () => {
  it.each(Object.entries(reads))(
    "%s queries once when a render calls it twice",
    async (_, read) => {
      const once = fakeContext();
      await read(once.context);
      expect(once.counter.from).toBeGreaterThan(0);

      const twice = fakeContext();
      await render(() => read(twice.context));
      expect(twice.counter.from).toBe(once.counter.from);
    },
  );
});
