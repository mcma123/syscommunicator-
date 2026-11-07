import {
  useSchoolNotifications,
  useSchoolWorkflows,
  useSchoolConnection,
  useSchoolModule,
  useSchoolRecords,
  useSchoolDetail,
  useSchoolDashboard,
  useNoticeReceipt,
} from "@school-connect/backend/react";
import { canAccessModule, type SchoolModule } from "@school-connect/core/permissions";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@school-connect/backend/client";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { accessRolesFor, type Role } from "../../../packages/school-core/src";
import { toast } from "sonner";

type Identity = NonNullable<FunctionReturnType<typeof api.users.current>>;
interface AppStore {
  role: Role;
  accessRoles: Role[];
  account: (Identity & { role: Role }) | null;
  sessionReady: boolean;
  signedIn: boolean;
  authenticate: (
    provider: string,
    params: Record<string, string>,
  ) => Promise<{ signingIn: boolean }>;
  signIn: (email: string, password: string) => Promise<{ signingIn: boolean }>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<null>;
  invite: (args: FunctionArgs<typeof api.onboarding.invite>) => Promise<string>;
  invitationLearners: { id: string; name: string }[];
  emailReady: boolean;
  demoEnabled: boolean;
  child: string;
  setChild: (child: string) => void;
  offline: boolean;
  connected: boolean;
  notify: (message: string) => void;
}
const Context = createContext<AppStore | null>(null);
export function SchoolProvider({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  const actions = useAuthActions();
  const identity = useQuery(api.users.current, auth.isAuthenticated ? {} : "skip");
  const configuration = useQuery(api.users.configuration, {});
  const invite = useAction(api.onboarding.invite);
  const accept = useMutation(api.onboarding.accept);
  const revoke = useAction(api.users.signOutEverywhere);
  const administrator = identity?.status === "Active" && identity.roles.includes("Administrator");
  const invitationLearners = useQuery(
    api.onboarding.invitationOptions,
    administrator ? {} : "skip",
  );
  const [child, setChild] = useState("all");
  const { offline, connected } = useSchoolConnection();
  useEffect(() => {
    setChild("all");
  }, [identity?.id]);
  const role: Role =
    (["Administrator", "Principal", "Finance", "Teacher"].find((r) =>
      identity?.roles.includes(r as Exclude<Role, "Parent">),
    ) as Role) ?? "Parent";
  const account = identity ? { ...identity, role } : null;
  const signOut = async () => {
    await actions.signOut();
    setChild("all");
  };
  return (
    <Context.Provider
      value={{
        role,
        accessRoles:
          identity?.status === "Active"
            ? accessRolesFor(identity.roles, identity.learners.length > 0)
            : [],
        account,
        signedIn: auth.isAuthenticated,
        sessionReady: !auth.isLoading && (!auth.isAuthenticated || identity !== undefined),
        authenticate: actions.signIn,
        signIn: (email, password) =>
          actions.signIn("password", { email, password, flow: "signIn" }),
        signOut,
        signOutEverywhere: async () => {
          await revoke({});
          await signOut();
        },
        acceptInvitation: (token) => accept({ token }),
        invite,
        invitationLearners: invitationLearners ?? [],
        emailReady: configuration?.emailReady ?? false,
        demoEnabled: configuration?.demoEnabled ?? false,
        child,
        setChild,
        offline,
        connected,
        notify: toast.success,
      }}
    >
      {children}
    </Context.Provider>
  );
}
/** Administrator roster import (Phase 11). Preview is a one-shot read so stale chunks never re-render. */
export function useRosterImport() {
  const { account } = useSchool();
  const enabled = account?.status === "Active" && account.roles.includes("Administrator");
  const convex = useConvex();
  const commit = useMutation(api.imports.commit);
  const complete = useMutation(api.imports.complete);
  const batches = useQuery(api.imports.batches, enabled ? {} : "skip");
  return {
    enabled,
    preview: (args: FunctionArgs<typeof api.imports.preview>) =>
      convex.query(api.imports.preview, args),
    commit,
    complete,
    batches,
  };
}
export function useSchool() {
  const store = useContext(Context);
  if (!store) throw new Error("SchoolProvider is required");
  return store;
}

export function useModule(module: SchoolModule) {
  const { account, accessRoles, child } = useSchool();
  const learnerId = child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id;
  return useSchoolModule(
    module,
    account?.status === "Active" && canAccessModule(accessRoles, module, account?.disabledModules),
    learnerId,
  );
}
export function useReceipt() {
  return useNoticeReceipt();
}

export function useRecords(
  module: import("@school-connect/core/live").ReadModule,
  options: import("@school-connect/core/live").ReadOptions = {},
  contextLearnerId?: string,
) {
  const { account, child } = useSchool();
  const learnerId =
    contextLearnerId ??
    (child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id);
  return useSchoolRecords(
    {
      module,
      ...options,
      ...(learnerId ? { learnerId } : {}),
    } as import("@school-connect/backend/client").ReadInput,
    account?.status === "Active",
  );
}
export function useDetail(
  module: import("@school-connect/core/live").ReadModule,
  id?: string,
  options: import("@school-connect/core/live").ReadOptions = {},
  contextLearnerId?: string,
) {
  const { account, child } = useSchool();
  const learnerId =
    contextLearnerId ??
    (child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id);
  return useSchoolDetail(
    {
      module,
      ...options,
      ...(learnerId ? { learnerId } : {}),
    } as import("@school-connect/backend/client").ReadInput,
    id,
    account?.status === "Active",
  );
}
export function useDashboard() {
  const { account, child } = useSchool();
  return useSchoolDashboard(
    account?.status === "Active",
    child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id,
  );
}

export function useWorkflows(
  module: import("@school-connect/core/live").ReadModule,
  itemId?: string,
  contextLearnerId?: string,
) {
  const { account, child } = useSchool();
  const learnerId =
    contextLearnerId ??
    (child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id);
  return useSchoolWorkflows(
    module,
    account?.status === "Active",
    itemId,
    learnerId as import("@school-connect/backend/dataModel").Id<"learners"> | undefined,
  );
}

export function useNotifications(noticeId?: string) {
  const { account } = useSchool();
  return useSchoolNotifications(
    account?.status === "Active",
    noticeId as import("@school-connect/backend/dataModel").Id<"notices"> | undefined,
  );
}
