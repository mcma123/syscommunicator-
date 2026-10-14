import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
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
  setRole: (role: Role) => void;
}

const Context = createContext<SchoolStore | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(createMockRepository);
  const [role, setRole] = useState<Role>("Parent");
  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );
  return (
    <Context.Provider value={{ state, update: repository.update, role, setRole }}>
      {children}
    </Context.Provider>
  );
}

export function useSchool() {
  const value = useContext(Context);
  if (!value) throw new Error("SchoolProvider is required");
  return value;
}
