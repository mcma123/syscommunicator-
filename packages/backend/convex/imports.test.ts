/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseImportCsv, type ImportKind } from "@school-connect/core/imports";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
beforeEach(() => vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true"));
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  await t.action(internal.seedFiles.run, {});
  const login = async (email: string) => {
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique(),
    );
    if (!user) throw new Error("Missing fixture user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 3600000 }),
    );
    return t.withIdentity({ subject: `${user._id}|${session}` });
  };
  return {
    t,
    admin: await login("admin@wgjs.example"),
    principal: await login("principal@wgjs.example"),
    parent: await login("parent@wgjs.example"),
  };
}
/** Same path the web client uses: parse the file, send its rows as raw cells. */
function chunk(kind: ImportKind, csv: string) {
  const header = csv.split("\n")[0].split(",");
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line, i) => ({
      row: i + 2,
      cells: Object.fromEntries(header.map((h, j) => [h, line.split(",")[j] ?? ""])),
    }));
}

const classesCsv = "grade,class_name,year\nGrade 4,4B,2026\nGrade 5,5A,2026\nGrade 1,4B,2026";
const learnersCsv = [
  "learner_number,first_name,last_name,preferred_name,date_of_birth,grade,class_name,year",
  "wg-100,Lerato,Mokoena,,2016-05-01,Grade 5,5A,2026",
  "DEMO-EMMA,Emma,Williams,Em,,Grade 4,4B,2026",
  "WG-101,Zara,Adams,,,Grade 5,9Z,2026",
].join("\n");
const guardiansCsv = [
  "learner_number,email,first_name,last_name,phone,relationship,primary_contact",
  "WG-100,Thandi@Example.org,Thandi,Mokoena,082 555 0100,Mother,yes",
  "DEMO-EMMA,parent@wgjs.example,Jane,Williams,,Mother,yes",
  "WG-999,nobody@example.org,No,Body,,Father,no",
].join("\n");
const staffCsv = [
  "email,first_name,last_name,phone,roles,class_names,year",
  "new.teacher@example.org,Anele,Dube,,Teacher,5A,2026",
  "teacher@wgjs.example,Sarah,Jacobs,,Teacher,,",
  "finance2@example.org,Fay,Nel,,Finance,5A,2026",
].join("\n");

it("allows only Administrators to preview, commit or list imports", async () => {
  const { principal, parent } = await setup();
  const rows = chunk("classes", classesCsv);
  for (const client of [principal, parent]) {
    await expect(client.query(api.imports.preview, { kind: "classes", rows })).rejects.toThrow(
      /cannot access/,
    );
    await expect(
      client.mutation(api.imports.commit, {
        kind: "classes",
        fileName: "c.csv",
        totalRows: 3,
        rows,
      }),
    ).rejects.toThrow(/cannot access/);
    await expect(client.query(api.imports.batches, {})).rejects.toThrow(/cannot access/);
  }
});

it("previews without writing, then commits classes and learners idempotently with audits", async () => {
  const { t, admin } = await setup();
  const before = await t.run((ctx) => ctx.db.query("classes").take(100));
  const preview = await admin.query(api.imports.preview, {
    kind: "classes",
    rows: chunk("classes", classesCsv),
  });
  expect(preview.map((r) => r.outcome)).toEqual(["unchanged", "create", "rejected"]);
  expect(preview[1].messages).toEqual(['Grade "Grade 5" will be created.']);
  expect(preview[2].messages[0]).toMatch(/another grade/);
  expect(await t.run((ctx) => ctx.db.query("classes").take(100))).toHaveLength(before.length);

  const classes = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "classes.csv",
    totalRows: 3,
    rows: chunk("classes", classesCsv),
  });
  expect(classes.results.map((r) => r.outcome)).toEqual(["unchanged", "create", "rejected"]);
  await admin.mutation(api.imports.complete, { batchId: classes.batchId });
  await expect(admin.mutation(api.imports.complete, { batchId: classes.batchId })).rejects.toThrow(
    /already complete/,
  );

  const learners = await admin.mutation(api.imports.commit, {
    kind: "learners",
    fileName: "learners.csv",
    totalRows: 3,
    rows: chunk("learners", learnersCsv),
  });
  expect(learners.results.map((r) => r.outcome)).toEqual(["create", "update", "rejected"]);
  expect(learners.results[1].messages).toEqual(["Updates preferredName."]);
  const created = await t.run((ctx) =>
    ctx.db
      .query("learners")
      .withIndex("by_learnerNumber", (q) => q.eq("learnerNumber", "WG-100"))
      .unique(),
  );
  expect(created).toMatchObject({
    firstName: "Lerato",
    status: "Active",
    dateOfBirth: "2016-05-01",
  });

  const again = await admin.mutation(api.imports.commit, {
    kind: "learners",
    fileName: "learners.csv",
    totalRows: 3,
    rows: chunk("learners", learnersCsv),
  });
  expect(again.results.map((r) => r.outcome)).toEqual(["unchanged", "unchanged", "rejected"]);

  const audits = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_targetTable_and_targetId", (q) =>
        q.eq("targetTable", "learners").eq("targetId", created!._id),
      )
      .take(5),
  );
  expect(audits.map((a) => a.action)).toEqual(["import.learner.created"]);
  const batches = await admin.query(api.imports.batches, {});
  expect(batches[0]).toMatchObject({
    kind: "learners",
    status: "Open",
    created: 0,
    unchanged: 2,
    rejected: 1,
  });
  expect(batches[2]).toMatchObject({
    kind: "classes",
    status: "Completed",
    created: 1,
    rejected: 1,
  });
});

it("stages guardians and staff without granting sign-in, roles or learner links", async () => {
  const { t, admin } = await setup();
  for (const [kind, csv] of [
    ["classes", classesCsv],
    ["learners", learnersCsv],
  ] as const)
    await admin.mutation(api.imports.commit, {
      kind,
      fileName: `${kind}.csv`,
      totalRows: 3,
      rows: chunk(kind, csv),
    });

  const guardians = await admin.mutation(api.imports.commit, {
    kind: "guardians",
    fileName: "guardians.csv",
    totalRows: 3,
    rows: chunk("guardians", guardiansCsv),
  });
  expect(guardians.results.map((r) => r.outcome)).toEqual(["create", "unchanged", "rejected"]);
  expect(guardians.results[1].messages).toEqual(["Already linked to an existing account."]);
  const staff = await admin.mutation(api.imports.commit, {
    kind: "staff",
    fileName: "staff.csv",
    totalRows: 3,
    rows: chunk("staff", staffCsv),
  });
  expect(staff.results.map((r) => r.outcome)).toEqual(["create", "unchanged", "rejected"]);
  expect(staff.results[2].messages).toEqual(["Only Teacher contacts can list classes."]);

  const state = await t.run(async (ctx) => ({
    contacts: await ctx.db.query("rosterContacts").take(10),
    users: await Promise.all(
      ["thandi@example.org", "new.teacher@example.org"].map((email) =>
        ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .unique(),
      ),
    ),
    invitations: await ctx.db.query("invitations").take(10),
  }));
  expect(state.contacts.map((c) => [c.kind, c.email, c.phone])).toEqual([
    ["Guardian", "thandi@example.org", "0825550100"],
    ["Staff", "new.teacher@example.org", undefined],
  ]);
  expect(state.users).toEqual([null, null]);
  expect(state.invitations).toEqual([]);

  const edited = guardiansCsv.replace(
    "Thandi,Mokoena,082 555 0100",
    "Thandi,Mokoena-Smith,082 555 0100",
  );
  const update = await admin.mutation(api.imports.commit, {
    kind: "guardians",
    fileName: "guardians.csv",
    totalRows: 3,
    rows: chunk("guardians", edited),
  });
  expect(update.results[0]).toMatchObject({ outcome: "update", messages: ["Updates lastName."] });
  expect(await t.run((ctx) => ctx.db.query("rosterContacts").take(10))).toHaveLength(2);
});

it("bounds chunks and declared totals and rolls back an over-long batch", async () => {
  const { t, admin } = await setup();
  const rows = chunk("classes", classesCsv);
  await expect(
    admin.mutation(api.imports.commit, {
      kind: "classes",
      fileName: "c.csv",
      totalRows: 3,
      rows: [],
    }),
  ).rejects.toThrow(/between 1 and 50/);
  await expect(
    admin.query(api.imports.preview, {
      kind: "classes",
      rows: [rows[0], { ...rows[1], row: rows[0].row }],
    }),
  ).rejects.toThrow(/unique/);
  await expect(
    admin.mutation(api.imports.commit, { kind: "classes", fileName: "c.csv", totalRows: 2, rows }),
  ).rejects.toThrow(/More rows/);
  expect(await t.run((ctx) => ctx.db.query("importBatches").take(5))).toEqual([]);
  const first = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 3,
    rows: rows.slice(0, 2),
  });
  await expect(
    admin.mutation(api.imports.commit, {
      kind: "learners",
      fileName: "c.csv",
      totalRows: 3,
      batchId: first.batchId,
      rows: rows.slice(2),
    }),
  ).rejects.toThrow(/closed/);
  const rest = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 3,
    batchId: first.batchId,
    rows: rows.slice(2),
  });
  expect(rest.batchId).toBe(first.batchId);
});

it("matches the shared parser's normalization end to end", () => {
  const parsed = parseImportCsv("guardians", guardiansCsv);
  expect(parsed.rows[0].key).toBe("thandi@example.org|WG-100");
});
