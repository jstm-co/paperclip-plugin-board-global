import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __BOARD_GLOBAL_VERSION__: JSON.stringify("2026.1103.0-dev+0000000"),
    __BOARD_GLOBAL_COMMIT__: JSON.stringify("0000000"),
  },
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
  },
});
