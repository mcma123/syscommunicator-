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
  await admin.mutation(api.imports.complete, { batchId: first.batchId });
});

it("refuses to complete a batch before every declared row is processed", async () => {
  const { admin } = await setup();
  const rows = chunk("classes", classesCsv);
  const partial = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 3,
    rows: rows.slice(0, 1),
  });
  await expect(admin.mutation(api.imports.complete, { batchId: partial.batchId })).rejects.toThrow(
    /incomplete: 1 of 3/,
  );
});

it("never erases stored primary contact or staff classes from blank optional cells", async () => {
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
  const guardian = "learner_number,email,first_name,last_name,phone,relationship,primary_contact";
  const staff = "email,first_name,last_name,phone,roles,class_names,year";
  const send = (kind: "guardians" | "staff", csv: string) =>
    admin.mutation(api.imports.commit, {
      kind,
      fileName: "f.csv",
      totalRows: 1,
      rows: chunk(kind, csv),
    });
  await send("guardians", `${guardian}\nWG-100,g@example.org,Gina,Mokoena,,Mother,yes`);
  await send("staff", `${staff}\nt2@example.org,Tom,Ngubane,,Teacher,5A,2026`);
  const blankGuardian = await send(
    "guardians",
    `${guardian}\nWG-100,g@example.org,Gina,Mokoena,,Mother,`,
  );
  const blankStaff = await send("staff", `${staff}\nt2@example.org,Tom,Ngubane,,Teacher,,`);
  expect(blankGuardian.results[0]!.outcome).toBe("unchanged");
  expect(blankStaff.results[0]!.outcome).toBe("unchanged");
  const demoted = await send("staff", `${staff}\nt2@example.org,Tom,Ngubane,,Finance,,`);
  expect(demoted.results[0]).toMatchObject({
    outcome: "rejected",
    messages: ["Only Teacher contacts can list classes."],
  });
  const contacts = await t.run((ctx) => ctx.db.query("rosterContacts").take(10));
  expect(contacts.find((c) => c.kind === "Guardian")?.isPrimaryContact).toBe(true);
  expect(contacts.find((c) => c.kind === "Staff")?.classIds).toHaveLength(1);
  const newGuardian = await send(
    "guardians",
    `${guardian}\nWG-100,h@example.org,Hope,Mokoena,,Father,`,
  );
  expect(newGuardian.results[0]!.outcome).toBe("create");
  const created = await t.run((ctx) => ctx.db.query("rosterContacts").take(10));
  expect(created.find((c) => c.email === "h@example.org")?.isPrimaryContact).toBe(false);
});

it("matches the shared parser's normalization end to end", () => {
  const parsed = parseImportCsv("guardians", guardiansCsv);
  expect(parsed.rows[0].key).toBe("thandi@example.org|WG-100");
});

it("refuses anonymous callers, non-admin completion and a disabled People module", async () => {
  const { t, admin, principal } = await setup();
  const rows = chunk("classes", classesCsv);
  await expect(t.query(api.imports.preview, { kind: "classes", rows })).rejects.toThrow();
  await expect(
    t.mutation(api.imports.commit, { kind: "classes", fileName: "c.csv", totalRows: 3, rows }),
  ).rejects.toThrow();
  const { batchId } = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 3,
    rows,
  });
  await expect(principal.mutation(api.imports.complete, { batchId })).rejects.toThrow(
    /cannot access/,
  );
  await expect(t.mutation(api.imports.complete, { batchId })).rejects.toThrow();
  await t.run(async (ctx) => {
    const school = (await ctx.db.query("schools").take(1))[0]!;
    await ctx.db.patch("schools", school._id, {
      featureFlags: { ...school.featureFlags, people: false },
    });
  });
  await expect(admin.query(api.imports.preview, { kind: "classes", rows })).rejects.toThrow(
    /cannot access/,
  );
  await expect(admin.query(api.imports.batches, {})).rejects.toThrow(/cannot access/);
  await expect(admin.mutation(api.imports.complete, { batchId })).rejects.toThrow(/cannot access/);
});

it("matches grades case-insensitively beyond the first page and caps new grades at 50", async () => {
  const { t, admin } = await setup();
  await t.run(async (ctx) => {
    const existing = await ctx.db.query("grades").take(100);
    for (let i = existing.length; i < 50; i++)
      await ctx.db.insert("grades", { name: `Extra ${i}`, sortOrder: 10 + i });
  });
  const lastGrade = "Extra 49";
  const send = (csv: string) =>
    admin.mutation(api.imports.commit, {
      kind: "classes",
      fileName: "c.csv",
      totalRows: 1,
      rows: chunk("classes", `grade,class_name,year\n${csv}`),
    });
  expect((await send(`${lastGrade},X1,2026`)).results[0]!.outcome).toBe("create");
  expect((await send("grade 4,4C,2026")).results[0]!.outcome).toBe("create");
  expect((await send(`${lastGrade.toUpperCase()},X1,2026`)).results[0]!.outcome).toBe("unchanged");
  const overflow = await send("Grade 99,Z1,2026");
  expect(overflow.results[0]).toMatchObject({ outcome: "rejected" });
  expect(overflow.results[0]!.messages[0]).toMatch(/already has 50 grades/);
  expect(await t.run((ctx) => ctx.db.query("grades").take(100))).toHaveLength(50);
});

it("counts each batch row once: exact replay is inert, changed replay is refused", async () => {
  const { t, admin } = await setup();
  const rows = chunk("classes", classesCsv);
  const first = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 2,
    rows: [rows[1]!],
  });
  // SEC-07: the same row sent again in another call must not count as a second row.
  const replay = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 2,
    batchId: first.batchId,
    rows: [rows[1]!],
  });
  expect(replay.results[0]).toMatchObject({
    outcome: "create",
    messages: ["Already processed in this import."],
  });
  await expect(admin.mutation(api.imports.complete, { batchId: first.batchId })).rejects.toThrow(
    /incomplete: 1 of 2/,
  );
  const changed = { ...rows[1]!, cells: { ...rows[1]!.cells, class_name: "5Z" } };
  await expect(
    admin.mutation(api.imports.commit, {
      kind: "classes",
      fileName: "c.csv",
      totalRows: 2,
      batchId: first.batchId,
      rows: [rows[0]!, changed],
    }),
  ).rejects.toThrow(/different content/);
  // The refused chunk rolled back entirely, including the new row 2 it carried.
  const state = await t.run(async (ctx) => ({
    batch: await ctx.db.get("importBatches", first.batchId),
    rows: await ctx.db.query("importBatchRows").take(10),
    classes: await ctx.db
      .query("classes")
      .withIndex("by_year_and_name", (q) => q.eq("year", 2026).eq("name", "5Z"))
      .take(1),
  }));
  expect(state.batch).toMatchObject({ created: 1, updated: 0, unchanged: 0, rejected: 0 });
  expect(state.rows.map((r) => r.row)).toEqual([3]);
  expect(state.classes).toEqual([]);
  await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 2,
    batchId: first.batchId,
    rows: [rows[0]!],
  });
  await admin.mutation(api.imports.complete, { batchId: first.batchId });
});

it("counts a row once when the same chunk is committed concurrently", async () => {
  const { t, admin } = await setup();
  const rows = chunk("classes", classesCsv);
  const opened = await admin.mutation(api.imports.commit, {
    kind: "classes",
    fileName: "c.csv",
    totalRows: 3,
    rows: [rows[0]!],
  });
  const send = () =>
    admin.mutation(api.imports.commit, {
      kind: "classes",
      fileName: "c.csv",
      totalRows: 3,
      batchId: opened.batchId,
      rows: [rows[1]!],
    });
  await Promise.all([send(), send()]);
  const batch = await t.run((ctx) => ctx.db.get("importBatches", opened.batchId));
  expect(batch!.created + batch!.updated + batch!.unchanged + batch!.rejected).toBe(2);
  await expect(admin.mutation(api.imports.complete, { batchId: opened.batchId })).rejects.toThrow(
    /incomplete: 2 of 3/,
  );
});

it("refuses row numbers that are not spreadsheet data rows", async () => {
  const { admin } = await setup();
  const row = chunk("classes", classesCsv)[0]!;
  for (const bad of [1, 0, -4, 2.5])
    await expect(
      admin.query(api.imports.preview, { kind: "classes", rows: [{ ...row, row: bad }] }),
    ).rejects.toThrow(/spreadsheet rows/);
});
