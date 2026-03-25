import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mindstore/plugin-sdk": path.resolve(__dirname, "packages/plugin-sdk/src/index.ts"),
      "@mindstore/plugin-runtime": path.resolve(__dirname, "packages/plugin-runtime/src/index.ts"),
      "@mindstore/example-community-plugin": path.resolve(
        __dirname,
        "packages/example-community-plugin/src/index.ts"
      ),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
