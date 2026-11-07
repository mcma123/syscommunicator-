import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@school-connect/backend/client";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  accessRolesFor,
  canAccessModule,
  type SchoolModule,
} from "@school-connect/core/permissions";
import type { StaffRole } from "@school-connect/core/domain";
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

interface SchoolStore {
  account: NonNullable<FunctionReturnType<typeof api.users.current>> | null;
  sessionReady: boolean;
  signedIn: boolean;
  emailReady: boolean;
  pushStatus: string;
  setPushStatus: (status: string) => void;
  pushRegistrationRequest: number;
  requestPushRegistration: () => void;
  registerPushDevice: (input: {
    token: string;
    platform: "ios" | "android";
    projectId: string;
  }) => Promise<null>;
  authenticate: (
    provider: string,
    params: Record<string, string>,
  ) => Promise<{ signingIn: boolean }>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<null>;
  roles: StaffRole[];
  offline: boolean;
  connected: boolean;
  child: string;
  setChild: (child: string) => void;
}

const Context = createContext<SchoolStore | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  const actions = useAuthActions();
  const account = useQuery(api.users.current, auth.isAuthenticated ? {} : "skip");
  const configuration = useQuery(api.users.configuration, {});
  const accept = useMutation(api.onboarding.accept);
  const revoke = useAction(api.users.signOutEverywhere);
  const registerPushDevice = useMutation(api.notifications.registerDevice);
  const unregisterPushDevice = useMutation(api.notifications.unregisterDevice);
  const [pushStatus, setPushStatus] = useState(
    "Phone notifications need an installed development build.",
  );
  const [pushRegistrationRequest, requestPushRegistration] = useState(0);
  const signOut = async () => {
    try {
      await unregisterPushDevice({});
    } catch {
      /* Session revocation independently blocks sends. */
    }
    await actions.signOut();
    setChild("all");
  };

  const [child, setChild] = useState("all");
  useEffect(() => setChild("all"), [account?.id]);
  const { offline, connected } = useSchoolConnection();
  return (
    <Context.Provider
      value={{
        account: account ?? null,
        pushStatus,
        setPushStatus,
        pushRegistrationRequest,
        requestPushRegistration: () => requestPushRegistration((v) => v + 1),
        registerPushDevice,
        sessionReady: !auth.isLoading && (!auth.isAuthenticated || account !== undefined),
        signedIn: auth.isAuthenticated,
        emailReady: configuration?.emailReady ?? false,
        authenticate: actions.signIn,
        signOut,
        signOutEverywhere: async () => {
          await revoke({});
          await signOut();
        },
        acceptInvitation: (token) => accept({ token }),
        roles: account?.roles ?? [],
        offline,
        connected,
        child,
        setChild,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSchool() {
  const value = useContext(Context);
  if (!value) throw new Error("SchoolProvider is required");
  return value;
}

export function useModule(module: SchoolModule) {
  const { account, child } = useSchool();
  const grants = accessRolesFor(account?.roles ?? [], !!account?.learners.length);
  const learnerId = child === "all" ? undefined : account?.learners.find((l) => l.id === child)?.id;
  return useSchoolModule(
    module,
    account?.status === "Active" && canAccessModule(grants, module, account?.disabledModules),
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
