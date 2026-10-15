import { Link, Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { canAccessDemoModule } from "./demo-auth";
import { useSchool } from "./store";

export function DemoSessionGate({ children }: { children: ReactNode }) {
  const { account, sessionReady } = useSchool();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!sessionReady)
    return (
      <div className="demo-session-loading" role="status">
        Opening WGJS Connect…
      </div>
    );
  if (pathname === "/signin") return account ? <Navigate to="/" replace /> : children;
  if (!account) return <Navigate to="/signin" replace />;
  if (!canAccessDemoModule(account.role, pathname.replace(/^\//, "").replace(/\/$/, ""))) {
    return (
      <div className="demo-session-loading">
        <p>This page is for staff demo accounts.</p>
        <Link to="/">Return to your home</Link>
      </div>
    );
  }
  return children;
}
