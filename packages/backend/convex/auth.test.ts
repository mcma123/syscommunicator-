/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { getFunctionName } from "convex/server";
import { api, internal } from "./_generated/api";
import { api as publicApi } from "../client";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { hashInvitation, linkAuthUser } from "./authPolicy";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const makeTest = () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  return t;
};
// Compilation proves the public client facade stays compatible with generated function types.
const clientContract: typeof publicApi = {
  imports: {
    preview: api.imports.preview,
    commit: api.imports.commit,
    complete: api.imports.complete,
    batches: api.imports.batches,
  },
  notifications: {
    registerDevice: api.notifications.registerDevice,
    unregisterDevice: api.notifications.unregisterDevice,
    configuration: api.notifications.configuration,
    history: api.notifications.history,
    retry: api.notifications.retry,
  },
  files: {
    beginUpload: api.files.beginUpload,
    claimUpload: api.files.claimUpload,
    finishUpload: api.files.finishUpload,
    prepareDownload: api.files.prepareDownload,
    downloadUrl: api.files.downloadUrl,
    resourceStatus: api.files.resourceStatus,
    removeAttachment: api.files.removeAttachment,
  },
  receiptFiles: { generate: api.receiptFiles.generate },
  workflowForms: { forms: api.workflowForms.forms },
  workflows: {
    submit: api.workflows.submit,
    uploadReport: api.workflows.uploadReport,
    reportFile: api.workflows.reportFile,
  },
  schoolRead: { page: api.schoolRead.page, detail: api.schoolRead.detail },
  dashboard: { current: api.dashboard.current, advance: api.dashboard.advance },
  ads: {
    active: api.ads.active,
    session: api.ads.session,
    media: api.ads.media,
    prepareUpload: api.ads.prepareUpload,
    finishUpload: api.ads.finishUpload,
    removeMedia: api.ads.removeMedia,
    moveMedia: api.ads.moveMedia,
  },
  schoolData: { list: api.schoolData.list },
  notices: {
    get: api.notices.get,
    listForMe: api.notices.listForMe,
    setReceipt: api.notices.setReceipt,
  },
  learners: { get: api.learners.get, listForClass: api.learners.listForClass },
  charges: { get: api.charges.get },
  resources: { get: api.resources.get },
  users: {
    current: api.users.current,
    configuration: api.users.configuration,
    signOutEverywhere: api.users.signOutEverywhere,
  },
  onboarding: {
    invite: api.onboarding.invite,
    accept: api.onboarding.accept,
    invitationOptions: api.onboarding.invitationOptions,
  },
};
type Test = ReturnType<typeof makeTest>;
let mail: { to: string[]; text: string; subject: string }[] = [];
beforeEach(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("JWT_PRIVATE_KEY", await exportPKCS8(keys.privateKey));
  vi.stubEnv(
    "JWKS",
    JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] }),
  );
  vi.stubEnv("SITE_URL", "http://localhost:8080");
  vi.stubEnv("CONVEX_SITE_URL", "https://diligent-bass-226.convex.site");
  vi.stubEnv("RESEND_API_KEY", "fake-test-key");
  vi.stubEnv("AUTH_EMAIL_FROM", "WGJS <signin@school.test>");
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  mail = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      mail.push(JSON.parse(String(init.body)));
      return Response.json({ id: "test-email" });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function session(t: Test, email: string, admin = false) {
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      name: "Test user",
      status: "Active",
      emailVerificationTime: 1,
    });
    if (admin) await ctx.db.insert("staffRoles", { userId, role: "Administrator" });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 3600000,
    });
    return { userId, sessionId };
  });
  return { ...ids, client: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
async function registered(t: Test, email = "parent@school.test") {
  return t.run((ctx) => ctx.db.insert("users", { email, name: "Parent", status: "Active" }));
}
async function verifiedPassword(t: Test, email = "parent@school.test") {
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password: "A strong test password", flow: "signUp" },
  });
  const code = mail.at(-1)!.text.match(/code is (\d+)/)![1];
  const result = await t.action(api.auth.signIn, {
    provider: "password",
    params: { email, code, flow: "email-verification" },
  });
  expect(result.tokens?.token).toBeTruthy();
  const subject = decodeJwt(result.tokens!.token).sub!;
  return t.withIdentity({ subject });
}
describe("authentication and onboarding", () => {
  it("exports the verified client identity and onboarding contract", () => {
    for (const group of [
      "users",
      "onboarding",
      "notices",
      "learners",
      "charges",
      "resources",
      "schoolData",
      "schoolRead",
      "dashboard",
      "ads",
    ] as const) {
      expect(Object.values(publicApi[group]).map(getFunctionName).sort()).toEqual(
        Object.values(clientContract[group]).map(getFunctionName).sort(),
      );
    }
  });
  it("requires email ownership and retains a registered user's identity", async () => {
    const t = makeTest();
    const id = await registered(t);
    const client = await verifiedPassword(t);
    expect((await client.query(api.users.current, {}))?.id).toBe(id);
    const accounts = await t.run((ctx) => ctx.db.query("authAccounts").take(10));
    expect(accounts.find((a) => a.provider === "password")?.secret).not.toBe(
      "A strong test password",
    );
    expect(await t.query(api.users.current, {})).toBeNull();
  });
  it("rejects unknown registration, short passwords and client-supplied roles", async () => {
    const t = makeTest();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          email: "unknown@school.test",
          password: "A strong test password",
          flow: "signUp",
          role: "Administrator",
        },
      }),
    ).rejects.toThrow();
    await registered(t);
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "parent@school.test", password: "short", flow: "signUp" },
      }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("staffRoles").take(1))).toHaveLength(0);
  });
  it("supports verified magic links and rejects reuse", async () => {
    const t = makeTest();
    const id = await registered(t);
    await t.action(api.auth.signIn, {
      provider: "school-email",
      params: { email: "parent@school.test", redirectTo: "/signin" },
    });
    const url = new URL(mail[0].text.match(/https?:\/\/\S+/)![0]);
    const code = url.searchParams.get("emailToken")!;
    expect(url.searchParams.has("code")).toBe(false);
    const result = await t.action(api.auth.signIn, {
      provider: "school-email",
      params: { email: "parent@school.test", code },
    });
    const client = t.withIdentity({ subject: decodeJwt(result.tokens!.token).sub! });
    expect((await client.query(api.users.current, {}))?.id).toBe(id);
    await expect(
      t.action(api.auth.signIn, {
        provider: "school-email",
        params: { email: "parent@school.test", code },
      }),
    ).rejects.toThrow();
  });
  it("verifies password reset codes, replaces the password and revokes previous sessions", async () => {
    const t = makeTest();
    await registered(t);
    const old = await verifiedPassword(t);
    await t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "parent@school.test", flow: "reset" },
    });
    const code = mail.at(-1)!.text.match(/code is (\d+)/)![1];
    await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        email: "parent@school.test",
        flow: "reset-verification",
        code,
        newPassword: "Another strong password",
      },
    });
    expect((await old.query(api.users.current, {}))?.status).toBe("Revoked");
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "parent@school.test", flow: "signIn", password: "A strong test password" },
      }),
    ).rejects.toThrow();
    expect(
      (
        await t.action(api.auth.signIn, {
          provider: "password",
          params: {
            email: "parent@school.test",
            flow: "signIn",
            password: "Another strong password",
          },
        })
      ).tokens,
    ).toBeTruthy();
  });
  it("revokes every session and rejects deactivated accounts immediately", async () => {
    const t = makeTest();
    const userId = await registered(t);
    const a = await verifiedPassword(t);
    const signed = await t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "parent@school.test", password: "A strong test password", flow: "signIn" },
    });
    const b = t.withIdentity({ subject: decodeJwt(signed.tokens!.token).sub! });
    await a.action(api.users.signOutEverywhere, {});
    expect((await b.query(api.users.current, {}))?.status).toBe("Revoked");
    await t.run((ctx) => ctx.db.patch("users", userId, { status: "Deactivated" }));
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "parent@school.test", password: "A strong test password", flow: "signIn" },
      }),
    ).rejects.toThrow();
  });
  it("only administrators issue invitations and accepts a token once for its verified recipient", async () => {
    const t = makeTest();
    const admin = await session(t, "admin@school.test", true);
    const parent = await session(t, "invitee@school.test");
    const other = await session(t, "other@school.test");
    const input = {
      email: "invitee@school.test",
      kind: "Staff" as const,
      staffRole: "Teacher" as const,
      learnerIds: [],
    };
    await expect(parent.client.action(api.onboarding.invite, input)).rejects.toThrow();
    await admin.client.action(api.onboarding.invite, input);
    const token = mail.at(-1)!.text.match(/Invitation code: ([a-f0-9]+)/)![1];
    const row = (await t.run((ctx) => ctx.db.query("invitations").take(2)))[0];
    expect(row.tokenHash).toBe(await hashInvitation(token));
    expect(row.tokenHash).not.toBe(token);
    await expect(other.client.mutation(api.onboarding.accept, { token })).rejects.toThrow();
    await expect(t.mutation(api.onboarding.accept, { token })).rejects.toThrow();
    await parent.client.mutation(api.onboarding.accept, { token });
    expect((await parent.client.query(api.users.current, {}))?.roles).toEqual(["Teacher"]);
    const roleAudit = await t.run((ctx) => ctx.db.query("auditLog").take(20));
    expect(roleAudit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "invitation.created", actorId: admin.userId }),
        expect.objectContaining({ action: "role.granted", actorId: parent.userId }),
        expect.objectContaining({ action: "invitation.accepted", actorId: parent.userId }),
      ]),
    );
    await expect(parent.client.mutation(api.onboarding.accept, { token })).rejects.toThrow();
  });
  it("links guardians only to invited learners and rejects expired or privilege-escalating invitations", async () => {
    const t = makeTest();
    const admin = await session(t, "admin@school.test", true);
    const parent = await session(t, "parent@school.test");
    const learnerId = await t.run(async (ctx) => {
      const gradeId = await ctx.db.insert("grades", { name: "Grade 4", sortOrder: 4 });
      const classId = await ctx.db.insert("classes", { gradeId, name: "4B", year: 2026 });
      return ctx.db.insert("learners", {
        firstName: "Test",
        lastName: "Learner",
        learnerNumber: "TEST",
        gradeId,
        classId,
        status: "Active",
      });
    });
    await expect(
      admin.client.mutation(internal.onboarding.recordInvitation, {
        email: "parent@school.test",
        kind: "Guardian",
        staffRole: "Administrator",
        learnerIds: [learnerId],
        tokenHash: "invalid",
      }),
    ).rejects.toThrow();
    const token = "a".repeat(64);
    const id = await admin.client.mutation(internal.onboarding.recordInvitation, {
      email: "parent@school.test",
      kind: "Guardian",
      learnerIds: [learnerId],
      tokenHash: await hashInvitation(token),
    });
    await t.run((ctx) => ctx.db.patch("invitations", id, { expiresAt: 0 }));
    await expect(parent.client.mutation(api.onboarding.accept, { token })).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch("invitations", id, { expiresAt: Date.now() + 100000 }));
    await parent.client.mutation(api.onboarding.accept, { token });
    const profile = await parent.client.query(api.users.current, {});
    expect(profile?.learners.map((l) => l.id)).toEqual([learnerId]);
    expect(profile?.roles).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("auditLog").take(20))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "guardian.linked", actorId: parent.userId }),
      ]),
    );
  });
  it("blocks demo identities without the development flag and on unknown deployments", async () => {
    const t = makeTest();
    const demo = await session(t, "parent@wgjs.example");
    vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "false");
    expect((await demo.client.query(api.users.current, {}))?.status).toBe("Deactivated");
    await expect(t.action(internal.developmentAuth.provision, {})).rejects.toThrow();
    vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
    expect((await demo.client.query(api.users.current, {}))?.status).toBe("Deactivated");
    await expect(t.action(internal.developmentAuth.provision, {})).rejects.toThrow();
  });
  it("fails email flows explicitly when email service is absent", async () => {
    const t = makeTest();
    await registered(t);
    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(await t.query(api.users.configuration, {})).toMatchObject({ emailReady: false });
    await expect(
      t.action(api.auth.signIn, {
        provider: "school-email",
        params: { email: "parent@school.test" },
      }),
    ).rejects.toThrow();
    expect(mail).toHaveLength(0);
  });
});
