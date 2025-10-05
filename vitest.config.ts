import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["./tests/setup.ts"],
    // ログ出力を最小限に抑制
    silent: true,
    reporter: "basic",
    logHeapUsage: false,
    outputFile: {
      json: "./test-results.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "vitest.config.ts",
        "coverage/",
      ],
    },
  },
});
