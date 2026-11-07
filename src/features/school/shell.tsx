import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  Mail,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
  MoreHorizontal,
  Shirt,
  LogOut,
  Award,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { schoolConfig } from "../../../packages/school-core/src";
import { useSchool } from "./store";
import { useTheme } from "@/lib/theme";
import { canAccessModule } from "@school-connect/core/permissions";
export const navigation = [
  { id: "home", name: "Home", path: "/", icon: Home },
  { id: "messages", name: "Messages", path: "/messages", icon: MessageSquare },
  { id: "calendar", name: "Calendar", path: "/calendar", icon: CalendarDays },
  { id: "children", name: "My children", path: "/children", icon: Users },
  { id: "resources", name: "Resources", path: "/resources", icon: BookOpen },
  { id: "payments", name: "Payments", path: "/payments", icon: CreditCard },
  { id: "forms", name: "Forms & consent", path: "/forms", icon: ClipboardList },
  { id: "contact", name: "Contact school", path: "/contact", icon: Mail },
] as const;
export const staffNavigation = [
  { id: "groups", name: "Groups & classes", path: "/groups", icon: Users },
  { id: "attendance", name: "Attendance", path: "/attendance", icon: ClipboardList },
  { id: "conduct", name: "Conduct", path: "/conduct", icon: Award },
  { id: "reports", name: "Reports", path: "/reports", icon: FileText },
  { id: "people", name: "People & invitations", path: "/people", icon: Users },
  { id: "audit", name: "Audit log", path: "/audit", icon: ShieldCheck },
] as const;
export function SchoolShell({ module, children }: { module: string; children: ReactNode }) {
  const { role, accessRoles, account, signOut, offline, connected, notify } = useSchool();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const title =
    module === "home"
      ? role === "Parent"
        ? "Parent home"
        : "Staff dashboard"
      : [
          ...navigation,
          ...staffNavigation,
          { id: "settings", name: "School settings" },
          { id: "profile", name: "My profile" },
          { id: "more", name: "More" },
          { id: "signin", name: "Welcome" },
        ].find((n) => n.id === module)?.name || module;
  const heading = role !== "Parent" && module === "children" ? "Learners" : title;
  return (
    <div className={collapsed ? "collapsed" : ""}>
      <aside className={`app-sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <img src={schoolConfig.logoUrl} alt={`${schoolConfig.name} crest`} />
          </div>
          <div className="brand-copy">
            <h2>{schoolConfig.name}</h2>
            <p>{schoolConfig.subtitle}</p>
          </div>
        </div>
        <div className="school-select">
          <div className="school-initial">W</div>
          <div>
            <strong>{schoolConfig.shortName}</strong>
            <div className="text-[9px] text-muted-foreground mt-1">
              School community · WGJS Connect
            </div>
          </div>
          <ChevronDown size={13} className="ml-auto text-muted-foreground" />
        </div>
        <div className="nav-caption">{role === "Parent" ? "YOUR SCHOOL" : "STAFF WORKSPACE"}</div>
        <nav className="side-nav">
          {navigation
            .filter((item) => canAccessModule(accessRoles, item.id, account?.disabledModules))
            .map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobile(false)}
                className={`nav-item ${module === item.id ? "active" : ""}`}
              >
                <item.icon />
                <span className="nav-text">
                  {role !== "Parent" && item.id === "children" ? "Learners" : item.name}
                </span>
              </Link>
            ))}
          {role !== "Parent" &&
            staffNavigation
              .filter((item) => canAccessModule(accessRoles, item.id, account?.disabledModules))
              .map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setMobile(false)}
                  className={`nav-item ${module === item.id ? "active" : ""}`}
                >
                  <item.icon />
                  <span className="nav-text">{item.name}</span>
                </Link>
              ))}
          <div className="mt-5 mb-2 border-t border-border" />
          <Link to="/profile" className={`nav-item ${module === "profile" ? "active" : ""}`}>
            <Settings />
            <span className="nav-text">Settings & profile</span>
          </Link>
          {canAccessModule(accessRoles, "settings", account?.disabledModules) && (
            <Link to="/settings" className={`nav-item ${module === "settings" ? "active" : ""}`}>
              <ShieldCheck />
              <span className="nav-text">School settings</span>
            </Link>
          )}
        </nav>
        <div className="sidebar-footer">
          {canAccessModule(accessRoles, "contact", account?.disabledModules) && (
            <Link
              to="/contact"
              className="flex items-center gap-2 text-xs text-muted-foreground no-underline mb-4"
            >
              <CircleHelp size={16} />
              Need a little help?
            </Link>
          )}
          <p>{schoolConfig.subtitle}</p>
          <Button
            variant="ghost"
            size="icon"
            title="Collapse sidebar"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-3"
          >
            <PanelLeftClose size={15} />
          </Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="flex items-center gap-2">
            <Button
              className="mobile-menu-button"
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </Button>
            <img className="mobile-school-logo" src={schoolConfig.logoUrl} alt="" />
            <span className="topbar-title">{heading}</span>
          </div>
          <div className="topbar-tools">
            {canAccessModule(accessRoles, "messages", account?.disabledModules) && (
              <form
                className="search-global"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query) notify("Search messages using the Messages page filters.");
                }}
              >
                <Search size={15} />
                <input
                  aria-label="Search school"
                  placeholder="Search your school…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>
            )}
            <span className="demo-account-role">{role}</span>
            <Button
              variant="ghost"
              size="icon"
              className="theme-toggle"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={dark}
              title={dark ? "Light mode" : "Dark mode"}
              onClick={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              title="Sign out / switch account"
              onClick={() => void signOut().catch(() => notify("Could not sign out. Try again."))}
            >
              <LogOut size={18} />
            </Button>
            <Link to="/profile" className="user-block no-underline text-foreground">
              <div className="avatar">
                {account?.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div>
                <strong>{account?.name}</strong>
                <span>{role} account</span>
              </div>
              <ChevronDown size={12} />
            </Link>
          </div>
        </header>
        {!connected && (
          <div className="status-banner" role="status">
            <WifiOff size={15} />
            {offline
              ? "Connection lost. Showing the last received information; changes require a connection."
              : "Connecting to your school..."}
          </div>
        )}
        <main className="content">
          <p role="note" className="status-banner">
            Connected to the school development database. Records are fictional test data.
          </p>
          {children}
          <footer className="subtle-footer">
            <span>
              © 2026 {schoolConfig.name} · {schoolConfig.subtitle}
            </span>
            <span>WGJS Connect · Africa/Johannesburg</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[
          ...navigation.slice(0, 4),
          { id: "more", name: "More", path: "/more" as const, icon: MoreHorizontal },
        ]
          .filter((item) => canAccessModule(accessRoles, item.id, account?.disabledModules))
          .map((item) => (
            <Link key={item.id} to={item.path} className={module === item.id ? "active" : ""}>
              <item.icon />
              {item.id === "children" ? "Children" : item.name}
            </Link>
          ))}
      </nav>
    </div>
  );
}
