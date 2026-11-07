import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "./audit-gate.mjs";

const advisory = (name, severity, id) => ({
  source: 1,
  name,
  dependency: name,
  title: "t",
  url: `https://github.com/advisories/${id}`,
  severity,
  range: "<9",
});
const report = (entries) => {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const e of Object.values(entries)) counts[e.severity]++;
  return {
    auditReportVersion: 2,
    vulnerabilities: entries,
    metadata: { vulnerabilities: { ...counts, total: Object.keys(entries).length } },
  };
};
const exception = (pkg, id, expires = "2026-12-07") => ({
  advisory: `https://github.com/advisories/${id}`,
  package: pkg,
  rationale: "r",
  owner: "o",
  followUp: "f",
  expires,
});
const TODAY = "2026-11-07";
const base = report({
  zod: { name: "zod", severity: "high", via: [advisory("zod", "high", "GHSA-mrhx-c7xc-m3w5")] },
  // Propagated entry: no advisory object of its own, counted as inherited, never gated by name.
  "convex-helpers": { name: "convex-helpers", severity: "high", via: ["zod"] },
  uuid: {
    name: "uuid",
    severity: "moderate",
    via: [advisory("uuid", "moderate", "GHSA-w5hq-g745-h8pq")],
  },
});

test("passes when every high advisory source has a valid exception; moderates and inherited only reported", () => {
  const r = gate(base, { exceptions: [exception("zod", "GHSA-mrhx-c7xc-m3w5")] }, TODAY);
  assert.equal(r.ok, true, r.failures.join("\n"));
  assert.equal(r.audit.inherited.length, 1);
});

test("fails an unexcepted high advisory, including a transitive package", () => {
  const r = gate(base, { exceptions: [] }, TODAY);
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /GHSA-mrhx-c7xc-m3w5 in zod/);
});

test("an exception must match both advisory and vulnerable package", () => {
  const r = gate(base, { exceptions: [exception("convex-helpers", "GHSA-mrhx-c7xc-m3w5")] }, TODAY);
  assert.equal(r.ok, false);
});

test("fails expired, incomplete or non-GHSA exception records even when unused", () => {
  for (const bad of [
    exception("zod", "GHSA-mrhx-c7xc-m3w5", "2026-11-06"),
    { ...exception("zod", "GHSA-mrhx-c7xc-m3w5"), owner: "" },
    { ...exception("zod", "GHSA-mrhx-c7xc-m3w5"), advisory: "https://example.com/x" },
    { ...exception("zod", "GHSA-mrhx-c7xc-m3w5"), expires: "07/12/2026" },
  ]) {
    const r = gate(base, { exceptions: [exception("zod", "GHSA-mrhx-c7xc-m3w5"), bad] }, TODAY);
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
});

test("fails npm errors and malformed or inconsistent reports", () => {
  const ex = { exceptions: [] };
  assert.equal(
    gate({ error: { code: "ENOTFOUND", summary: "fetch failed" } }, ex, TODAY).ok,
    false,
  );
  assert.equal(gate({ auditReportVersion: 2, metadata: base.metadata }, ex, TODAY).ok, false);
  assert.equal(gate({ ...base, metadata: { vulnerabilities: { total: 3 } } }, ex, TODAY).ok, false);
  assert.equal(
    gate(
      { ...base, metadata: { vulnerabilities: { ...base.metadata.vulnerabilities, total: 9 } } },
      ex,
      TODAY,
    ).ok,
    false,
  );
  assert.equal(gate({ ...base, auditReportVersion: 1 }, ex, TODAY).ok, false);
  assert.equal(
    gate(report({ x: { severity: "high", via: [{ name: "x" }] } }), ex, TODAY).ok,
    false,
  );
});

test("a clean report passes with no exceptions", () => {
  assert.equal(gate(report({}), { exceptions: [] }, TODAY).ok, true);
});
