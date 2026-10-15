import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(root, "apps/expo");
const require = createRequire(resolve(app, "package.json"));
const cli = resolve(dirname(require.resolve("expo/package.json")), "bin/cli");

// The QR must contain the same direct exp:// tunnel URL that works on a phone.
// Expo otherwise inserts a runtime chooser when expo-dev-client is installed.
// Preserve the terminal so Expo can render its QR and keyboard shortcuts.
// Development never loads the private account .env.
const result = spawnSync(
  process.execPath,
  [cli, "start", "--go", "--tunnel", "--port", "8082", ...process.argv.slice(2)],
  { cwd: app, stdio: "inherit", env: { ...process.env, EXPO_NO_REDIRECT_PAGE: "1" } },
);
if (result.error) {
  console.error("Could not start the Expo Go tunnel:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? (result.signal === "SIGINT" ? 130 : 1));
