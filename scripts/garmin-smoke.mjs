const base = process.env.GARMIN_API_URL;
const token = process.env.GARMIN_SMOKE_ACCESS_TOKEN;

if (!base) {
  console.error("Set GARMIN_API_URL to run the Garmin smoke check.");
  process.exit(1);
}

const checks = [
  ["/healthz", undefined, 200],
  ["/readyz", undefined, 200],
  ["/v1/connections/garmin", undefined, 401],
  ["/v1/connections/garmin", "invalid", 401],
  ...(token
    ? [
        ["/v1/connections/garmin", token, 200],
        ["/v1/connections/garmin/sync", token, 200],
      ]
    : []),
];

let failed = false;
for (const [path, bearer, expected] of checks) {
  const response = await fetch(new URL(path, base), {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const status = response?.status ?? "unreachable";
  const label = `${path}${bearer ? " (bearer)" : ""}`;
  const passed = status === expected;
  failed ||= !passed;
  console.log(`${passed ? "ok  " : "FAIL"} ${label}: ${status}`);
}
if (!token) console.log("skip authenticated reads: no access token set");
process.exit(failed ? 1 : 0);
