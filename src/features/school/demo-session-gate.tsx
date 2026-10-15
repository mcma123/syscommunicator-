import { Link, Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { schoolConfig } from "../../../packages/school-core/src";
import { canAccessDemoModule } from "./demo-auth";
import { useSchool } from "./store";

export function DemoSessionGate({ children }: { children: ReactNode }) {
  const { account, sessionReady } = useSchool();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!sessionReady)
    return (
      <div className="demo-session-loading" role="status">
        <div className="school-loading-crest">
          <img
            src={schoolConfig.logoUrl}
            alt={`${schoolConfig.name} crest`}
            width={112}
            height={112}
            fetchPriority="high"
          />
        </div>
        <div className="school-loading-brand">
          <strong>{schoolConfig.name}</strong>
          <p>{schoolConfig.subtitle}</p>
        </div>
        <span className="school-loading-message">Opening {schoolConfig.shortName}…</span>
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
