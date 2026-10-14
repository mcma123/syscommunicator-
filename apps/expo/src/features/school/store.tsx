import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createMockRepository,
  type Role,
  type SchoolRepository,
  type SchoolState,
} from "@school-connect/core";

interface SchoolStore {
  state: SchoolState;
  update: SchoolRepository["update"];
  role: Role;
  processing: boolean;
  simulatePayment: () => void;
  child: string;
  setChild: (child: string) => void;
  consentPhone: string;
  setConsentPhone: (phone: string) => void;
  outcome: "Paid" | "Failed" | "Pending verification";
  setOutcome: (outcome: "Paid" | "Failed" | "Pending verification") => void;
}

const Context = createContext<SchoolStore | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(createMockRepository);
  const role: Role = "Parent";
  const [child, setChild] = useState("all");
  const [consentPhone, setConsentPhone] = useState("");
  const [outcome, setOutcome] = useState<"Paid" | "Failed" | "Pending verification">("Paid");
  const [processing, setProcessing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const simulatePayment = () => {
    if (timer.current) return;
    repository.update((current) => ({ ...current, payment: "Pending verification" }));
    setProcessing(true);
    timer.current = setTimeout(() => {
      repository.update((current) => ({ ...current, payment: outcome }));
      setProcessing(false);
      timer.current = null;
    }, 1000);
  };
  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );
  return (
    <Context.Provider
      value={{
        state,
        update: repository.update,
        role,
        processing,
        simulatePayment,
        child,
        setChild,
        consentPhone,
        setConsentPhone,
        outcome,
        setOutcome,
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
