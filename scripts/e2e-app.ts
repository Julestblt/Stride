import { spawn } from "node:child_process";
import config from "../playwright.config";

export async function main(): Promise<number> {
  const servers = [config.webServer ?? []].flat();
  const app = servers.find((server) => server.url === config.use?.baseURL);
  if (!app?.command) throw new Error("The e2e app server is not configured.");
  process.stdout.write(
    `Serving the e2e app on ${app.url}. Run specs with PLAYWRIGHT_REUSE_APP=true.\n`,
  );
  const env: NodeJS.ProcessEnv = { ...process.env, ...app.env };
  Reflect.deleteProperty(env, "NODE_ENV");
  const child = spawn(app.command, { shell: true, stdio: "inherit", env });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return new Promise((resolve) =>
    child.once("exit", (code) => resolve(code ?? 0)),
  );
}
