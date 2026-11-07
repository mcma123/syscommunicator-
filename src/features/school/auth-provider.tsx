import { type ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const memory = new Map<string, string>();
export const browserTokenStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Session stays in memory. */
    }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
  },
};
export function SchoolAuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  client: ConvexReactClient | null;
}) {
  if (!client)
    return (
      <main className="demo-session-loading">
        <p>Sign-in is unavailable. Configure the school connection and reload.</p>
      </main>
    );
  return (
    <ConvexAuthProvider client={client} storage={browserTokenStorage} shouldHandleCode={false}>
      {children}
    </ConvexAuthProvider>
  );
}
