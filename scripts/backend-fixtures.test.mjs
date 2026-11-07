import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureEnvironment, main } from "./backend-fixtures.mjs";

const dev = {
  CONVEX_DEPLOYMENT: "dev:diligent-bass-226",
  CONVEX_URL: "https://diligent-bass-226.convex.cloud",
};
test("fixture CLI accepts only the identified dev target", () => {
  assert.equal(fixtureEnvironment(dev, {}).CONVEX_DEPLOYMENT, dev.CONVEX_DEPLOYMENT);
  for (const overrides of [
    { CONVEX_DEPLOYMENT: "prod:other" },
    { CONVEX_DEPLOYMENT: "dev:other" },
    { CONVEX_URL: "https://other.convex.cloud" },
  ]) {
    assert.throws(() => fixtureEnvironment(dev, overrides), /blocked/);
  }
  assert.throws(() => fixtureEnvironment({}, {}), /blocked/);
});
test("fixture CLI rejects credential overrides without printing their values", () => {
  for (const name of [
    "CONVEX_DEPLOY_KEY",
    "CONVEX_SELF_HOSTED_ADMIN_KEY",
    "CONVEX_SELF_HOSTED_URL",
  ]) {
    assert.throws(
      () => fixtureEnvironment(dev, { [name]: "do-not-print" }),
      (error) => !error.message.includes("do-not-print"),
    );
  }
});
test("fixture CLI rejects extra flags before reading credentials or running commands", () => {
  assert.throws(() => main(["seed", "--prod"]), /no deployment overrides/);
  assert.throws(() => main(["invalid"]), /Usage/);
});
