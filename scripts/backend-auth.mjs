import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { generateKeyPair, exportPKCS8, exportJWK } from "jose";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { fixtureEnvironment } from "./backend-fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "packages/backend");
const privateFile = resolve(root, ".env.auth.local");
const childEnv = fixtureEnvironment(
  parseEnv(readFileSync(resolve(backend, ".env.local"), "utf8")),
  process.env,
);
const command = process.argv[2];
if (process.argv.length !== 3 || !["setup", "smoke"].includes(command))
  throw new Error("Usage: node scripts/backend-auth.mjs setup|smoke");
const run = (args, input) => {
  console.log("target: dev (diligent-bass-226, personal dev)");
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "node_modules/convex/bin/main.js"),
      ...args,
      "--env-file",
      resolve(backend, ".env.local"),
    ],
    { cwd: backend, env: childEnv, input, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      `Convex ${args[0]} failed. Check deployment configuration; secret values were not logged.`,
    );
  return result.stdout;
};
const roles = ["PARENT", "TEACHER", "PRINCIPAL", "FINANCE", "ADMIN"];
try {
  if (command === "setup") {
    const names = new Set(
      run(["env", "list"])
        .split(/\r?\n/)
        .map((line) => line.split("=")[0].trim()),
    );
    if (names.has("JWT_PRIVATE_KEY") !== names.has("JWKS"))
      throw new Error(
        "Auth signing configuration is incomplete; refusing automatic key replacement.",
      );
    if (!names.has("JWT_PRIVATE_KEY")) {
      const keys = await generateKeyPair("RS256", { extractable: true });
      const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replaceAll("\n", " ");
      const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
      run(["env", "set", "JWT_PRIVATE_KEY"], privateKey);
      run(["env", "set", "JWKS"], jwks);
    }
    if (!names.has("SITE_URL")) run(["env", "set", "SITE_URL"], "http://localhost:8080");
    run(["env", "set", "ENABLE_DEMO_ACCOUNTS"], "true");
    console.log(run(["dev", "--once"]));
    if (!existsSync(privateFile)) {
      writeFileSync(
        privateFile,
        "# Private dev credentials. Never commit or bundle.\n" +
          roles
            .map((role) => `DEV_AUTH_PASSWORD_${role}=${randomBytes(24).toString("base64url")}`)
            .join("\n") +
          "\n",
        { flag: "wx", mode: 0o600 },
      );
    }
    const credentials = parseEnv(readFileSync(privateFile, "utf8"));
    try {
      for (const role of roles) {
        const key = `DEV_AUTH_PASSWORD_${role}`;
        if (!credentials[key]) throw new Error("Private dev credential file is incomplete.");
        run(["env", "set", key], credentials[key]);
      }
      run(["run", "developmentAuth:provision", "{}"]);
    } finally {
      for (const role of roles) run(["env", "remove", `DEV_AUTH_PASSWORD_${role}`]);
    }
    console.log(
      "Auth configured. Private dev passwords are in the ignored .env.auth.local file; no passwords or signing keys were printed.",
    );
  } else {
    console.log("target: dev (diligent-bass-226, personal dev)");
    const credentials = parseEnv(readFileSync(privateFile, "utf8"));
    const signin = makeFunctionReference("auth:signIn");
    const current = makeFunctionReference("users:current");
    const revoke = makeFunctionReference("users:signOutEverywhere");
    const client = () => new ConvexHttpClient(childEnv.CONVEX_URL);
    const login = async (role) => {
      const c = client();
      const result = await c.action(signin, {
        provider: "password",
        params: {
          email: `${role.toLowerCase()}@wgjs.example`,
          password: credentials[`DEV_AUTH_PASSWORD_${role}`],
          flow: "signIn",
        },
      });
      if (!result.tokens?.token) throw new Error("Real password sign-in did not return a session.");
      c.setAuth(result.tokens.token);
      return c;
    };
    const web = await login("PARENT");
    const mobile = await login("PARENT");
    const a = await web.query(current, {});
    const b = await mobile.query(current, {});
    if (!a || a.status !== "Active" || a.id !== b?.id || a.learners.length !== 2)
      throw new Error("Cross-client identity mismatch.");
    const admin = await login("ADMIN");
    const staff = await admin.query(current, {});
    if (!staff?.roles.includes("Administrator")) throw new Error("Staff role mismatch.");
    const teacher = await login("TEACHER");
    const finance = await login("FINANCE");
    const notices = makeFunctionReference("notices:listForMe");
    const learner = makeFunctionReference("learners:get");
    const refuse = async (operation) => {
      let refused = false;
      try {
        await operation();
      } catch {
        refused = true;
      }
      if (!refused) throw new Error("Unauthorized module access was allowed.");
    };
    const own = await web.query(learner, { learnerId: a.learners[0].id });
    if (own._id !== a.learners[0].id) throw new Error("Guardian scope mismatch.");
    const page = await web.query(notices, { paginationOpts: { cursor: null, numItems: 10 } });
    if (page.page.some((notice) => notice.status !== "Published"))
      throw new Error("Parent publication scope mismatch.");
    await refuse(() => finance.query(notices, { paginationOpts: { cursor: null, numItems: 10 } }));
    await refuse(() => client().query(learner, { learnerId: a.learners[0].id }));
    const assigned = await teacher.query(learner, { learnerId: a.learners[0].id });
    const outside = a.learners.find((child) => child.classId !== assigned.classId);
    if (!outside) throw new Error("Class-scope fixture missing.");
    await refuse(() => teacher.query(learner, { learnerId: outside.id }));
    await admin.query(learner, { learnerId: outside.id });
    for (const account of [teacher, finance])
      await account.action(makeFunctionReference("auth:signOut"), {});
    await web.action(revoke, {});
    if ((await mobile.query(current, {}))?.status !== "Revoked")
      throw new Error("Session revocation failed.");
    await admin.action(makeFunctionReference("auth:signOut"), {});
    console.log(
      "PASS: real parent sign-in from two independent clients, shared identity and linked learners, staff sign-in, guardian/class/publication/Finance/signed-out authorization, and sign-out everywhere.",
    );
  }
} catch {
  console.error(
    "Auth setup/verification failed. Check deployment settings and private credentials. No secret values were logged.",
  );
  process.exitCode = 1;
}
