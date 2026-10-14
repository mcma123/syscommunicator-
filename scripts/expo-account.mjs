import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
if (!process.env.EXPO_TOKEN) {
  console.error("Set EXPO_TOKEN in the ignored root .env before using Expo account commands.");
  process.exit(1);
}

const commands = {
  whoami: ["whoami"],
  init: ["init", "--force", "--non-interactive"],
  info: ["project:info"],
};
const args = commands[process.argv[2]];
if (!args) {
  console.error("Usage: node scripts/expo-account.mjs whoami|init|info");
  process.exit(1);
}

const app = resolve(root, "apps/expo");
// EAS can update static app.json but cannot automatically edit dynamic config.
// The dynamic wrapper inherits app.json, so temporarily hide it for init only.
const dynamicConfig = resolve(app, "app.config.ts");
const savedConfig = resolve(app, ".app.config.eassetup.ts");
const temporarilyHideConfig = process.argv[2] === "init" && existsSync(dynamicConfig);
if (temporarilyHideConfig && existsSync(savedConfig)) {
  console.error("A previous EAS config backup exists. Restore it before retrying init.");
  process.exit(1);
}
let result;
try {
  if (temporarilyHideConfig) renameSync(dynamicConfig, savedConfig);
  // Keep EAS outside app dependencies, as required by Expo diagnostics.
  // Arguments come only from the fixed allowlist above; no credentials appear here.
  result = spawnSync("npx", ["--yes", "eas-cli@24.13.0", ...args], {
    cwd: app,
    env: { ...process.env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
} finally {
  if (temporarilyHideConfig && existsSync(savedConfig)) renameSync(savedConfig, dynamicConfig);
}
if (result.error) {
  console.error("Could not start EAS CLI.");
  process.exit(1);
}
process.exit(result.status ?? 1);
