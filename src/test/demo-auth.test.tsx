import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  authenticateDemo,
  canAccessDemoModule,
  DEMO_ACCOUNTS,
  findDemoAccount,
} from "../features/school/demo-auth";
import { DEMO_SESSION_KEY, SchoolProvider, useSchool } from "../features/school/store";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("demo credentials", () => {
  it.each(DEMO_ACCOUNTS)("opens the $role account without returning its password", (account) => {
    expect(authenticateDemo(account.email, account.password)).toEqual({
      id: account.id,
      name: account.name,
      role: account.role,
      email: account.email,
    });
  });

  it("normalizes emails but requires the exact password for that account", () => {
    expect(authenticateDemo(" PARENT@WGJS.EXAMPLE ", "ParentDemo!26")?.role).toBe("Parent");
    expect(authenticateDemo("parent@wgjs.example", "TeacherDemo!26")).toBeNull();
    expect(authenticateDemo("parent@wgjs.example", "parentdemo!26")).toBeNull();
    expect(authenticateDemo("parent@wgjs.example", " ParentDemo!26 ")).toBeNull();
    expect(authenticateDemo("unknown@wgjs.example", "ParentDemo!26")).toBeNull();
    expect(findDemoAccount('{"role":"Administrator"}')).toBeNull();
  });

  it("keeps staff-only module previews out of the parent view", () => {
    for (const module of [
      "groups",
      "attendance",
      "conduct",
      "reports",
      "people",
      "audit",
      "settings",
    ]) {
      expect(canAccessDemoModule("Parent", module)).toBe(false);
      expect(canAccessDemoModule("Teacher", module)).toBe(true);
    }
    expect(canAccessDemoModule("Parent", "payments")).toBe(true);
    expect(canAccessDemoModule("Parent", "profile")).toBe(true);
  });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <SchoolProvider>{children}</SchoolProvider>
);

describe("demo session lifecycle", () => {
  it("starts signed out and leaves invalid credentials signed out", async () => {
    const { result } = renderHook(useSchool, { wrapper });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.account).toBeNull();
    act(() => {
      expect(result.current.signIn("parent@wgjs.example", "incorrect")).toBe(false);
    });
    expect(result.current.account).toBeNull();
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it("preserves repository changes across account switches while resetting view state", async () => {
    const { result } = renderHook(useSchool, { wrapper });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => {
      result.current.signIn("parent@wgjs.example", "ParentDemo!26");
      result.current.update((state) => ({ ...state, notifications: false }));
      result.current.setChild("emma");
      result.current.setOffline(true);
    });
    act(() => result.current.signOut());
    expect(result.current.account).toBeNull();
    expect(result.current.child).toBe("all");
    expect(result.current.offline).toBe(false);
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
    act(() => {
      result.current.signIn("finance@wgjs.example", "FinanceDemo!26");
    });
    expect(result.current.role).toBe("Finance");
    expect(result.current.state.notifications).toBe(false);
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBe("finance");
  });

  it("restores a recognized account ID after remount and ignores unknown IDs", async () => {
    sessionStorage.setItem(DEMO_SESSION_KEY, "principal");
    const first = renderHook(useSchool, { wrapper });
    await waitFor(() => expect(first.result.current.account?.role).toBe("Principal"));
    first.unmount();
    sessionStorage.setItem(DEMO_SESSION_KEY, "not-an-account");
    const second = renderHook(useSchool, { wrapper });
    await waitFor(() => expect(second.result.current.sessionReady).toBe(true));
    expect(second.result.current.account).toBeNull();
  });

  it("still signs in and out when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(useSchool, { wrapper });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => {
      expect(result.current.signIn("admin@wgjs.example", "AdminDemo!26")).toBe(true);
    });
    expect(result.current.role).toBe("Administrator");
    act(() => result.current.signOut());
    expect(result.current.account).toBeNull();
  });
});
