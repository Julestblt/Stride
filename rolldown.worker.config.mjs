import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";

const source = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  input: "src/server/coaching/worker/main.ts",
  platform: "node",
  tsconfig: "tsconfig.json",
  resolve: { alias: { "@": source } },
  external: (id) =>
    !id.startsWith(".") &&
    !id.startsWith("/") &&
    !id.startsWith("@/") &&
    !id.startsWith("\0") &&
    id !== "server-only",
  plugins: [
    {
      name: "server-only",
      resolveId: (id) => (id === "server-only" ? "\0server-only" : null),
      load: (id) => (id === "\0server-only" ? "export {};" : null),
    },
  ],
  output: { file: "build/coach-worker.mjs", format: "esm" },
});
