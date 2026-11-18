import { Link, Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { schoolConfig } from "../../../packages/school-core/src";
import { canAccessModule } from "./demo-auth";
import { AccountAccess } from "./account-management";
import { useSchool } from "./store";

export function DemoSessionGate({ children }: { children: ReactNode }) {
  const { account, sessionReady, accessRoles } = useSchool();
  const pathname = useLocation({ select: (location) => location.pathname });
  // Public business pages: no sign-in, no school data.
  if (pathname === "/advertise" || pathname.startsWith("/advertise/")) return children;
  if (!sessionReady)
    return (
      <div className="demo-session-loading" role="status">
        <div className="school-loading-crest">
          <img
            src={schoolConfig.logoUrl}
            alt="SYS logo"
            width={112}
            height={112}
            fetchPriority="high"
          />
        </div>
        <div className="school-loading-brand">
          <strong>{schoolConfig.appName}</strong>
          <p>Support Your School</p>
        </div>
        <span className="school-loading-message">Opening {schoolConfig.shortName}…</span>
      </div>
    );
  if (pathname === "/signin") return children;
  if (!account) return <Navigate to="/signin" replace />;
  if (account.status !== "Active" || (!account.roles.length && !account.learners.length))
    return <AccountAccess />;
  if (
    !canAccessModule(
      accessRoles,
      pathname.replace(/^\//, "").replace(/\/$/, "") || "home",
      account.disabledModules,
    )
  ) {
    return (
      <div className="demo-session-loading">
        <p>This module is not available for your school account.</p>
        <Link to="/">Return to your home</Link>
      </div>
    );
  }
  return children;
}
