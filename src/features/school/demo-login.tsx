import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { schoolConfig } from "../../../packages/school-core/src";
import campus from "@/assets/school-campus.jpg";
import { DEMO_ACCOUNTS } from "./demo-auth";
import { useSchool } from "./store";

const roleIcons = [HeartHandshake, BookOpen, GraduationCap, Landmark, ShieldCheck];
const descriptions = [
  "Stay close to every school day.",
  "More time for teaching. Everything in one place.",
  "A clear view of your school community.",
  "Keep school finances moving with confidence.",
  "Bring your school community together.",
];

export function DemoLogin() {
  const { signIn } = useSchool();
  const [selected, setSelected] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const account = DEMO_ACCOUNTS[selected]!;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn(email, password))
      setError(
        "Those details don’t match a demo account. Use the credentials below and try again.",
      );
  }

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
            <span className="demo-login-eyebrow">
              <span /> A LITTLE CLOSER. EVERY DAY.
            </span>
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
            <div className="demo-login-community">
              <span>
                <Users size={19} />
              </span>
              <div>
                <strong>One school. One community.</strong>
                <small>Parents, teachers and staff, together.</small>
              </div>
            </div>
          </div>
          <div className="demo-login-story-footer">
            <span>{schoolConfig.shortName}</span>
            <span>
              {schoolConfig.subtitle} <Sparkles size={14} />
            </span>
          </div>
        </div>
      </section>

      <section className="demo-login-panel" aria-labelledby="login-heading">
        <div className="demo-login-form-wrap">
          <div className="demo-login-mobile-brand">
            <img src={schoolConfig.logoUrl} alt="School crest" />
            <strong>{schoolConfig.shortName}</strong>
          </div>
          <span className="demo-login-demo-badge">
            <span /> INTERACTIVE DEMO
          </span>
          <h2 id="login-heading">
            Welcome back<span>.</span>
          </h2>
          <p className="demo-login-intro">
            Your school day, beautifully connected.
            <br />
            Choose a profile to explore the demo.
          </p>

          <div className="demo-login-roles" role="group" aria-label="Choose a demo profile">
            {DEMO_ACCOUNTS.map((item, index) => {
              const Icon = roleIcons[index] ?? Users;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => {
                    setSelected(index);
                    setError("");
                  }}
                >
                  <Icon size={18} />
                  <span>{item.role === "Administrator" ? "Admin" : item.role}</span>
                  {selected === index && <Check className="demo-login-role-check" size={11} />}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="demo-login-form">
            <label htmlFor="demo-email">Email address</label>
            <div className="demo-login-input">
              <Mail size={18} />
              <input
                id="demo-email"
                type="email"
                autoComplete="username"
                placeholder="Your demo email address"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "demo-login-error" : undefined}
              />
            </div>
            <label htmlFor="demo-password">Password</label>
            <div className="demo-login-input">
              <LockKeyhole size={18} />
              <input
                id="demo-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your demo password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "demo-login-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p id="demo-login-error" className="demo-login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="demo-login-submit">
              Sign in to WGJS Connect <ArrowRight size={18} />
            </button>
          </form>

          <div className="demo-login-credentials" aria-live="polite">
            <div className="demo-login-credentials-heading">
              <span className="demo-login-credentials-icon">
                <Sparkles size={17} />
              </span>
              <div>
                <strong>Try the {account.role.toLowerCase()} experience</strong>
                <p>{descriptions[selected]}</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{account.email}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>{account.password}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                setError("");
              }}
            >
              Use these details <ArrowRight size={15} />
            </button>
          </div>
          <p className="demo-login-disclaimer">
            <ShieldCheck size={15} /> Demo accounts only. All people and school records are
            fictional.
          </p>
          <footer className="demo-login-footer">
            {schoolConfig.name}
            <span>{schoolConfig.subtitle}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
