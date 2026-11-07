#!/usr/bin/env node
// Dependency advisory gate for CI.
// Usage: node scripts/audit-gate.mjs <npm-audit.json> <exceptions.json> [--today YYYY-MM-DD]
//
// Reads an `npm audit --json` report. Every high or critical advisory source (including transitive
// packages) must match an unexpired exception that names its exact advisory URL and vulnerable
// package. Exits 1 on an unexcepted advisory, a malformed/incomplete report, an npm audit error,
// or an invalid/expired exception record. npm's own exit code 1 with a valid report is normal input.
// Exceptions are temporary CI tolerances, not production risk acceptance.
import { readFileSync, appendFileSync } from "node:fs";

const GATED = new Set(["high", "critical"]);
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const FIELDS = ["advisory", "package", "rationale", "owner", "followUp", "expires"];

/** Returns { advisories, inherited, counts } or throws when the report is not a usable audit. */
export function readAudit(report) {
  if (!report || typeof report !== "object") throw new Error("Audit report is not a JSON object.");
  if (report.error) throw new Error(`npm audit reported an error: ${JSON.stringify(report.error)}`);
  if (report.auditReportVersion !== 2)
    throw new Error("Unsupported or missing auditReportVersion (expected 2).");
  const { vulnerabilities, metadata } = report;
  if (!vulnerabilities || typeof vulnerabilities !== "object")
    throw new Error("Audit report has no vulnerabilities object.");
  const totals = metadata?.vulnerabilities;
  if (!totals || SEVERITIES.some((s) => typeof totals[s] !== "number"))
    throw new Error("Audit report has incomplete metadata.vulnerabilities counts.");
  const advisories = new Map();
  const inherited = [];
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!entry || !Array.isArray(entry.via) || !SEVERITIES.includes(entry.severity))
      throw new Error(`Malformed vulnerability entry for ${name}.`);
    const sources = entry.via.filter((v) => typeof v === "object" && v !== null);
    if (sources.length === 0) inherited.push({ name, severity: entry.severity });
    for (const v of sources) {
      if (
        typeof v.url !== "string" ||
        typeof v.name !== "string" ||
        !SEVERITIES.includes(v.severity)
      )
        throw new Error(`Malformed advisory source under ${name}.`);
      advisories.set(`${v.url}|${v.name}`, {
        url: v.url,
        package: v.name,
        severity: v.severity,
        range: v.range ?? "",
      });
    }
  }
  const counted = Object.keys(vulnerabilities).length;
  if (counted !== totals.total)
    throw new Error(`metadata total ${totals.total} does not match ${counted} entries.`);
  return { advisories: [...advisories.values()], inherited, totals };
}

/** Validates exception records; returns { valid, problems }. */
export function readExceptions(file, today) {
  const problems = [];
  if (!file || !Array.isArray(file.exceptions))
    return { valid: [], problems: ["Exceptions file must contain an exceptions array."] };
  const valid = [];
  file.exceptions.forEach((e, i) => {
    const label = `exception ${i + 1}`;
    const missing = FIELDS.filter((f) => typeof e?.[f] !== "string" || e[f].trim() === "");
    if (missing.length > 0) return problems.push(`${label}: missing ${missing.join(", ")}.`);
    if (
      !/^https:\/\/github\.com\/advisories\/GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(e.advisory)
    )
      return problems.push(`${label}: advisory must be an exact GitHub advisory URL.`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(e.expires) ||
      Number.isNaN(Date.parse(`${e.expires}T00:00:00Z`))
    )
      return problems.push(`${label}: expires must be YYYY-MM-DD.`);
    if (e.expires < today)
      return problems.push(`${label}: expired on ${e.expires} (${e.package}).`);
    valid.push(e);
  });
  return { valid, problems };
}

export function gate(report, exceptionsFile, today) {
  const failures = [];
  let audit;
  try {
    audit = readAudit(report);
  } catch (error) {
    return { ok: false, failures: [error.message], audit: null, excepted: [], unused: [] };
  }
  const { valid, problems } = readExceptions(exceptionsFile, today);
  failures.push(...problems);
  const used = new Set();
  const excepted = [];
  for (const a of audit.advisories.filter((x) => GATED.has(x.severity))) {
    const match = valid.find((e) => e.advisory === a.url && e.package === a.package);
    if (match) {
      used.add(match);
      excepted.push({ ...a, expires: match.expires, owner: match.owner });
    } else
      failures.push(
        `${a.severity} advisory ${a.url} in ${a.package} (${a.range}) has no valid exception.`,
      );
  }
  const unused = valid.filter((e) => !used.has(e)).map((e) => `${e.package} ${e.advisory}`);
  return { ok: failures.length === 0, failures, audit, excepted, unused };
}

function summarize(result) {
  const lines = ["## Dependency advisory gate", ""];
  if (result.audit) {
    const t = result.audit.totals;
    lines.push(
      `npm audit entries: ${t.total} (critical ${t.critical}, high ${t.high}, moderate ${t.moderate}, low ${t.low}).`,
    );
    lines.push(
      `Advisory sources: ${result.audit.advisories.length}; inherited-only entries: ${result.audit.inherited.length}.`,
      "",
    );
    lines.push("| Severity | Package | Advisory | Status |", "| --- | --- | --- | --- |");
    for (const a of result.audit.advisories) {
      const ex = result.excepted.find((e) => e.url === a.url && e.package === a.package);
      const status = !GATED.has(a.severity)
        ? "reported"
        : ex
          ? `excepted until ${ex.expires} (${ex.owner})`
          : "FAILING";
      lines.push(`| ${a.severity} | ${a.package} | ${a.url} | ${status} |`);
    }
    lines.push("");
  }
  if (result.unused.length)
    lines.push(`Unused exceptions (remove when fixed): ${result.unused.join("; ")}`, "");
  lines.push(
    result.ok
      ? "Result: pass (exceptions are temporary CI tolerances, not risk acceptance)."
      : "Result: FAIL",
  );
  for (const f of result.failures) lines.push(`- ${f}`);
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const todayIndex = args.indexOf("--today");
  const today =
    todayIndex >= 0 ? args.splice(todayIndex, 2)[1] : new Date().toISOString().slice(0, 10);
  const [reportPath, exceptionsPath] = args;
  if (!reportPath || !exceptionsPath) {
    console.error(
      "Usage: node scripts/audit-gate.mjs <npm-audit.json> <exceptions.json> [--today YYYY-MM-DD]",
    );
    process.exit(2);
  }
  let result;
  try {
    result = gate(
      JSON.parse(readFileSync(reportPath, "utf8")),
      JSON.parse(readFileSync(exceptionsPath, "utf8")),
      today,
    );
  } catch (error) {
    result = {
      ok: false,
      failures: [`Could not read inputs: ${error.message}`],
      audit: null,
      excepted: [],
      unused: [],
    };
  }
  const text = summarize(result);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  process.exit(result.ok ? 0 : 1);
}
