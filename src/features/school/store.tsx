import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createMockRepository,
  type Role,
  type SchoolState,
  type SchoolRepository,
} from "../../../packages/school-core/src";
import { toast } from "sonner";
import { authenticateDemo, findDemoAccount, type DemoAccount } from "./demo-auth";

export const DEMO_SESSION_KEY = "wgjs.demo.account";

interface AppStore {
  state: SchoolState;
  update: SchoolRepository["update"];
  role: Role;
  account: DemoAccount | null;
  sessionReady: boolean;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
  child: string;
  setChild: (child: string) => void;
  offline: boolean;
  setOffline: (offline: boolean) => void;
  notify: (message: string) => void;
}

const Context = createContext<AppStore | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(createMockRepository);
  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [child, setChild] = useState("all");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    try {
      setAccount(findDemoAccount(sessionStorage.getItem(DEMO_SESSION_KEY)));
    } catch {
      // The demo also works in memory when browser storage is unavailable.
    }
    setSessionReady(true);
  }, []);

  function signIn(email: string, password: string) {
    const next = authenticateDemo(email, password);
    if (!next) return false;
    setAccount(next);
    setChild("all");
    setOffline(false);
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, next.id);
    } catch {
      /* Storage is optional for this frontend demo. */
    }
    return true;
  }

  function signOut() {
    setAccount(null);
    setChild("all");
    setOffline(false);
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* Storage is optional for this frontend demo. */
    }
  }

  const update: SchoolRepository["update"] = (fn) => {
    if (offline) {
      toast.error("You’re offline. Reconnect before saving changes.");
      return;
    }
    repository.update(fn);
  };

  return (
    <Context.Provider
      value={{
        state,
        update,
        role: account?.role ?? "Parent",
        account,
        sessionReady,
        signIn,
        signOut,
        child,
        setChild,
        offline,
        setOffline,
        notify: toast.success,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSchool() {
  const store = useContext(Context);
  if (!store) throw new Error("SchoolProvider is required");
  return store;
}
