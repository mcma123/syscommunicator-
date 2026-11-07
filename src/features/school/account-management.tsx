import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSchool } from "./store";
import type { Id } from "@school-connect/backend/dataModel";
import type { StaffRole } from "../../../packages/school-core/src";

export function AccountAccess() {
  const { account, signOut, acceptInvitation, sessionReady } = useSchool();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("invitation") ?? "");
  }, []);
  if (!account)
    return sessionReady ? (
      <section>
        <p role="alert">No school profile is available for this session. Contact the school.</p>
        <button
          onClick={() => void signOut().catch(() => setMessage("Please reload and try again."))}
        >
          Return to sign in
        </button>
        <p role="status">{message}</p>
      </section>
    ) : (
      <p role="status">Loading your account...</p>
    );
  if (account.status !== "Active")
    return (
      <section className="demo-login-form">
        <p role="alert">
          {account.status === "Revoked"
            ? "Your session has ended. Sign in again."
            : "This account is deactivated. Contact the school."}
        </p>
        <button
          onClick={() => void signOut().catch(() => setMessage("Please reload and try again."))}
        >
          Return to sign in
        </button>
        <p role="status">{message}</p>
      </section>
    );
  return (
    <section className="demo-login-form">
      <p>
        Signed in as {account.name} ({account.email}).
      </p>
      {account.roles.length > 0 || account.learners.length > 0 ? (
        <Link to="/">Open school portal</Link>
      ) : (
        <p>Your account needs a school invitation. Ask the school administrator for access.</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await acceptInvitation(token.trim());
            setToken("");
            window.history.replaceState({}, "", "/signin");
            setMessage("Invitation accepted. Your school access has been updated.");
          } catch {
            setMessage(
              "Could not accept this invitation. Check its code, email address and expiry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="invitation-code">Invitation code</label>
        <input
          className="field"
          id="invitation-code"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          autoComplete="off"
        />
        <button className="demo-login-submit" disabled={busy} type="submit">
          Accept invitation
        </button>
      </form>
      <p role="status">{message}</p>
      <button
        onClick={() => void signOut().catch(() => setMessage("Please reload and try again."))}
      >
        Sign out
      </button>
    </section>
  );
}

export function AccountManagement() {
  const { account, signOutEverywhere } = useSchool();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="record-card">
      <h2>Your school account</h2>
      <p>{account?.email}</p>
      <p>{account?.roles.join(", ") || "Parent"}</p>
      <p>Linked learners: {account?.learners.map((l) => l.name).join(", ") || "None"}</p>
      <button
        className="field"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signOutEverywhere();
          } catch {
            setMessage("Could not sign out all sessions. Try again.");
            setBusy(false);
          }
        }}
      >
        Sign out everywhere
      </button>
      <p role="status">{message}</p>
    </section>
  );
}

export function PeopleInvitations() {
  const { invite, account, invitationLearners, emailReady } = useSchool();
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("Guardian");
  const [role, setRole] = useState<StaffRole>("Teacher");
  const [learnerIds, setLearnerIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!account?.roles.includes("Administrator"))
    return <p>Only an Administrator can invite people.</p>;
  return (
    <section className="record-card">
      <h2>Invite a school account</h2>
      <p>Invitations grant access after the recipient verifies their email and accepts the code.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await invite({
              email,
              kind: kind as "Guardian" | "Staff",
              ...(kind === "Staff" ? { staffRole: role } : {}),
              learnerIds: learnerIds as Id<"learners">[],
            });
            setMessage("Invitation email sent.");
            setEmail("");
          } catch {
            setMessage(
              "Invitation could not be sent. Check the email-service configuration and selected learners.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Access
          <select
            className="field"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLearnerIds([]);
            }}
          >
            <option value="Guardian">Parent / guardian</option>
            <option value="Staff">Staff</option>
          </select>
        </label>
        {kind === "Staff" ? (
          <label>
            Role
            <select
              className="field"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              {["Teacher", "Principal", "Finance", "Administrator"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        ) : (
          <fieldset>
            <legend>Linked learners</legend>
            {invitationLearners.map((learner) => (
              <label key={learner.id} className="setting-row">
                <span>{learner.name}</span>
                <input
                  type="checkbox"
                  checked={learnerIds.includes(learner.id)}
                  onChange={(e) =>
                    setLearnerIds(
                      e.target.checked
                        ? [...learnerIds, learner.id]
                        : learnerIds.filter((id) => id !== learner.id),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
        )}
        <button className="demo-login-submit" disabled={busy || !emailReady} type="submit">
          Send invitation
        </button>
      </form>
      {!emailReady && <p>Email delivery is awaiting the school's Resend configuration.</p>}
      <p role="status">{message}</p>
    </section>
  );
}
