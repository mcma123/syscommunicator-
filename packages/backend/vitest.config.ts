import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    maxWorkers: 1,
    testTimeout: 15000,
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    env: { CONVEX_CLOUD_URL: "https://diligent-bass-226.convex.cloud" },
  },
});
