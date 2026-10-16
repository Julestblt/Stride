import { fileURLToPath } from "node:url";
import { createViteServer } from "vitest/node";

const [entry, ...args] = process.argv.slice(2);
if (!entry)
  throw new Error("Usage: node scripts/run-ts.mjs <module.ts> [args]");
const server = await createViteServer({
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  plugins: [
    {
      name: "server-only",
      resolveId: (id) => (id === "server-only" ? "\0server-only" : null),
      load: (id) => (id === "\0server-only" ? "export {};" : null),
    },
  ],
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const loaded = await server.ssrLoadModule(entry);
  process.exitCode = await loaded.main(args);
} finally {
  await server.close();
}
