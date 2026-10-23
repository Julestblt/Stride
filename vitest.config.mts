import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          exclude: ["tests/unit/server-render/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "server",
          include: ["tests/unit/server-render/**/*.test.ts"],
          execArgv: ["--conditions=react-server"],
        },
      },
    ],
  },
});
