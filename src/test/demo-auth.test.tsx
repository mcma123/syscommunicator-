import { act, cleanup, renderHook, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getFunctionName } from "convex/server";
import { canAccessModule } from "../features/school/demo-auth";
import { SchoolLogin } from "../features/school/demo-login";
import { SchoolProvider, useSchool } from "../features/school/store";
import { browserTokenStorage } from "../features/school/auth-provider";
const mocks = vi.hoisted(() => ({
  identity: null as null | {
    id: string;
    name: string;
    email: string;
    status: string;
    roles: string[];
    learners: unknown[];
  },
  loading: false,
  signedIn: false,
  signIn: vi.fn(async () => ({ signingIn: true })),
  signOut: vi.fn(async () => {}),
  action: vi.fn(async () => null),
  mutation: vi.fn(async () => null),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn, signOut: mocks.signOut }),
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: mocks.loading, isAuthenticated: mocks.signedIn }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) =>
    args === "skip"
      ? undefined
      : getFunctionName(ref) === "users:current"
        ? mocks.identity
        : getFunctionName(ref) === "users:configuration"
          ? { emailReady: false, demoEnabled: false }
          : [],
  useAction: () => mocks.action,
  useMutation: () => mocks.mutation,
  ConvexReactClient: vi.fn(),
  useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true }),
}));
const wrapper = ({ children }: { children: ReactNode }) => (
  <SchoolProvider>{children}</SchoolProvider>
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.identity = null;
  mocks.loading = false;
  mocks.signedIn = false;
  vi.clearAllMocks();
});
describe("real account state", () => {
  it("offers sign-out when an authenticated session has no school profile", () => {
    mocks.signedIn = true;
    render(<SchoolLogin />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent("No school profile is available");
    expect(screen.getByRole("button", { name: "Return to sign in" })).toBeInTheDocument();
  });
  it("renders real sign-in fields without the credential picker", () => {
    render(<SchoolLogin />, { wrapper });
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByText("Use these details")).toBeNull();
    expect(screen.getByRole("button", { name: "Create your password" })).toBeDisabled();
  });
  it("shows revoked session feedback instead of a sign-in success screen", () => {
    mocks.signedIn = true;
    mocks.identity = {
      id: "server-user",
      name: "Parent",
      email: "parent@school.test",
      status: "Revoked",
      roles: [],
      learners: [],
    };
    render(<SchoolLogin />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended");
  });

  it("starts signed out and ignores old browser demo IDs", () => {
    sessionStorage.setItem("wgjs.demo.account", "admin");
    const { result } = renderHook(useSchool, { wrapper });
    expect(result.current.account).toBeNull();
    expect(result.current.sessionReady).toBe(true);
  });
  it("uses server identity and roles and restores loading state", () => {
    mocks.loading = true;
    const hook = renderHook(useSchool, { wrapper });
    expect(hook.result.current.sessionReady).toBe(false);
    mocks.loading = false;
    mocks.signedIn = true;
    mocks.identity = {
      id: "server-user",
      name: "School Administrator",
      email: "admin@school.test",
      status: "Active",
      roles: ["Administrator"],
      learners: [],
    };
    hook.rerender();
    expect(hook.result.current.account?.id).toBe("server-user");
    expect(hook.result.current.role).toBe("Administrator");
  });
  it("delegates passwords to the auth provider and does not store them in browser storage", async () => {
    const { result } = renderHook(useSchool, { wrapper });
    await act(async () => {
      await result.current.signIn("parent@school.test", "private password");
    });
    expect(mocks.signIn).toHaveBeenCalledWith("password", {
      email: "parent@school.test",
      password: "private password",
      flow: "signIn",
    });
    expect(sessionStorage.getItem("password")).toBeNull();
  });
  it("resets the selected learner on signout without owning school records", async () => {
    const { result } = renderHook(useSchool, { wrapper });
    act(() => result.current.setChild("server-learner"));
    await act(async () => {
      await result.current.signOut();
    });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(result.current.child).toBe("all");
    expect(result.current).not.toHaveProperty("state");
    expect(result.current).not.toHaveProperty("update");
    expect(result.current).not.toHaveProperty("setOffline");
  });
  it("preserves backend revoked/deactivated state for the session gate", () => {
    mocks.signedIn = true;
    mocks.identity = {
      id: "server-user",
      name: "Parent",
      email: "parent@school.test",
      status: "Revoked",
      roles: [],
      learners: [],
    };
    const { result } = renderHook(useSchool, { wrapper });
    expect(result.current.account?.status).toBe("Revoked");
  });
  it("continues in memory when browser token storage is blocked", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    browserTokenStorage.setItem("auth-test", "session");
    expect(browserTokenStorage.getItem("auth-test")).toBe("session");
    browserTokenStorage.removeItem("auth-test");
    expect(browserTokenStorage.getItem("auth-test")).toBeNull();
  });
  it("keeps staff modules out of parent navigation", () => {
    for (const module of [
      "groups",
      "attendance",
      "conduct",
      "reports",
      "people",
      "audit",
      "settings",
      "ads",
    ]) {
      expect(canAccessModule("Parent", module)).toBe(false);
      expect(canAccessModule("Teacher", module)).toBe(
        !["people", "settings", "audit"].includes(module),
      );
    }
    expect(canAccessModule("Parent", "profile")).toBe(true);
  });
});
