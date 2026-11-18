import { useEffect, useState, type FormEvent } from "react";
import { schoolConfig } from "../../../packages/school-core/src";
import campus from "@/assets/school-campus.jpg";
import { useSchool } from "./store";
import { AccountAccess } from "./account-management";

type Mode = "signIn" | "signUp" | "verify" | "reset" | "resetVerify" | "magic";
export function SchoolLogin() {
  const { authenticate, account, signedIn, emailReady, demoEnabled } = useSchool();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setEmailToken(params.get("emailToken") ?? "");
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const normalized = email.trim().toLowerCase();
      if (emailToken) {
        await authenticate("school-email", { email: normalized, code: emailToken });
        setEmailToken("");
        window.history.replaceState({}, "", "/signin");
      } else if (mode === "magic") {
        await authenticate("school-email", { email: normalized });
        setNotice("Check your email for the sign-in link. Keep this page open.");
      } else {
        const flow =
          mode === "verify"
            ? "email-verification"
            : mode === "resetVerify"
              ? "reset-verification"
              : mode;
        const params: Record<string, string> = { email: normalized, flow };
        if (mode === "signIn" || mode === "signUp") params["password"] = password;
        if (mode === "verify" || mode === "resetVerify") params["code"] = code;
        if (mode === "resetVerify") params["newPassword"] = password;
        const result = await authenticate("password", params);
        if (mode === "reset") {
          setMode("resetVerify");
          setNotice("Enter the code from your email and a new password.");
        } else if (!result.signingIn && (mode === "signIn" || mode === "signUp")) {
          setMode("verify");
          setNotice("Enter the verification code from your email.");
        }
        setPassword("");
      }
    } catch {
      setError(
        "We could not complete sign-in. Check your email, password or code and try again. Contact the school if you need help.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<Mode, string> = {
    signIn: "Sign in to Syscommunicator",
    signUp: "Create your password",
    verify: "Verify email",
    reset: "Send reset code",
    resetVerify: "Save new password",
    magic: "Email a sign-in link",
  };
  return (
    <main className="demo-login">
      <section className="demo-login-story" aria-label="Welcome to your school community">
        <img className="demo-login-campus" src={campus} alt="" />
        <div className="demo-login-story-inner">
          <a href="/signin" className="demo-login-brand">
            <span className="demo-login-crest">
              <img src={schoolConfig.logoUrl} alt="School crest" />
            </span>
            <span>
              {schoolConfig.name}
              <small>{schoolConfig.subtitle}</small>
            </span>
          </a>
          <div className="demo-login-story-copy">
            <span className="demo-login-eyebrow">A LITTLE CLOSER. EVERY DAY.</span>
            <h1>
              Big school moments.
              <br />
              Little everyday wins.
              <br />
              <em>All connected.</em>
            </h1>
            <p>
              From the first bell to the next big milestone, feel part of every moment in your
              school community.
            </p>
          </div>
          <div className="demo-login-story-footer">
            <span>{schoolConfig.shortName}</span>
            <span>{schoolConfig.subtitle}</span>
          </div>
        </div>
      </section>
      <section className="demo-login-panel" aria-labelledby="login-heading">
        <div className="demo-login-form-wrap">
          <div className="demo-login-mobile-brand">
            <img src={schoolConfig.logoUrl} alt="School crest" />
            <strong>{schoolConfig.shortName}</strong>
          </div>
          <h2 id="login-heading">
            Welcome back<span>.</span>
          </h2>
          <p className="demo-login-intro">Use the email registered with your school.</p>
          {signedIn ? (
            <AccountAccess />
          ) : (
            <>
              <form onSubmit={submit} className="demo-login-form">
                <label htmlFor="school-email">Email address</label>
                <div className="demo-login-input">
                  <input
                    id="school-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!!emailToken}
                  />
                </div>
                {!emailToken && ["signIn", "signUp", "resetVerify"].includes(mode) && (
                  <>
                    <label htmlFor="school-password">
                      {mode === "resetVerify" ? "New password" : "Password"}
                    </label>
                    <div className="demo-login-input">
                      <input
                        id="school-password"
                        type="password"
                        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                        minLength={mode === "signIn" ? 1 : 12}
                        maxLength={128}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {!emailToken && ["verify", "resetVerify"].includes(mode) && (
                  <>
                    <label htmlFor="school-code">Email code</label>
                    <div className="demo-login-input">
                      <input
                        id="school-code"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {error && (
                  <p role="alert" className="demo-login-error">
                    {error}
                  </p>
                )}
                {notice && <p role="status">{notice}</p>}
                <button className="demo-login-submit" disabled={busy} type="submit">
                  {busy
                    ? "Please wait..."
                    : emailToken
                      ? `Confirm sign-in as ${email}`
                      : labels[mode]}
                </button>
              </form>
              {!emailToken && (
                <div className="demo-login-credentials">
                  {(["signIn", "signUp", "magic", "reset"] as Mode[])
                    .filter((m) => m !== mode)
                    .map((m) => (
                      <button
                        key={m}
                        disabled={busy || (!emailReady && m !== "signIn")}
                        onClick={() => {
                          setMode(m);
                          setError("");
                          setNotice("");
                          setPassword("");
                          setCode("");
                        }}
                      >
                        {labels[m]}
                      </button>
                    ))}
                </div>
              )}
              {!emailReady && (
                <p role="status">
                  Email activation and recovery are awaiting the school's email-service setup.
                </p>
              )}
              {demoEnabled && (
                <p className="demo-login-disclaimer">
                  Development accounts are enabled. Use privately provisioned credentials;
                  school-module data is fictional.
                </p>
              )}
            </>
          )}
          <footer className="demo-login-footer">
            {schoolConfig.name}
            <span>{schoolConfig.subtitle}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
