import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "packages/backend");
const deployment = "dev:diligent-bass-226";
const cloudUrl = "https://diligent-bass-226.convex.cloud";

export function fixtureEnvironment(fileEnv, inherited) {
  const merged = { ...fileEnv, ...inherited };
  if (
    merged.CONVEX_DEPLOY_KEY ||
    merged.CONVEX_SELF_HOSTED_ADMIN_KEY ||
    merged.CONVEX_SELF_HOSTED_URL
  ) {
    throw new Error("Fixture commands refuse deploy keys and self-hosted overrides.");
  }
  if (merged.CONVEX_DEPLOYMENT !== deployment || merged.CONVEX_URL !== cloudUrl) {
    throw new Error(
      "Fixture commands require dev:diligent-bass-226 and its matching CONVEX_URL; production and unknown targets are blocked.",
    );
  }
  return merged;
}

export function main(args = process.argv.slice(2)) {
  const [command] = args;
  if (args.length !== 1 || !["seed", "reset", "verify"].includes(command)) {
    throw new Error(
      "Usage: node scripts/backend-fixtures.mjs seed|reset|verify (no deployment overrides)",
    );
  }
  const config = JSON.parse(readFileSync(resolve(backend, "convex.json"), "utf8"));
  if (config.functions !== "convex/") throw new Error("Unexpected backend functions directory.");
  const fileEnv = parseEnv(readFileSync(resolve(backend, ".env.local"), "utf8"));
  const childEnv = fixtureEnvironment(fileEnv, process.env);
  const invoke = (cliArgs) => {
    console.log("target: dev (diligent-bass-226, personal dev)");
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/convex/bin/main.js"),
        ...cliArgs,
        "--env-file",
        resolve(backend, ".env.local"),
      ],
      {
        cwd: backend,
        env: childEnv,
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Convex command failed (${result.status ?? result.signal}).`);
  };
  if (command !== "verify") {
    invoke(["dev", "--once"]);
    if (command === "reset") {
      console.log(
        "Reset replaces ALL application data in this development database and removes seed-owned sample files.",
      );
      invoke(["run", "seed:reset", "{}"]);
    }
    invoke(["run", "seedFiles:run", "{}"]);
  }
  invoke(["run", "seed:verify", "{}"]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
