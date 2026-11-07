import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Mail,
  MessageSquare,
  Shirt,
} from "lucide-react";
import type { ReadModule } from "@school-connect/core/live";
import { canAccessModule, type SchoolModule } from "@school-connect/core/permissions";
import { NOTICE_CATEGORIES } from "@school-connect/core/domain";
import { money, schoolConfig } from "@school-connect/core";
import { SchoolDataBoundary } from "@school-connect/backend/react";
import { Button } from "@/components/ui/button";
import campus from "@/assets/school-campus.jpg";
import { useDashboard, useRecords, useSchool } from "./store";
import { EventRow, NoticeCard, Placeholder } from "./components";
import { formatDate } from "./format";

export type OpenRecord = (module: ReadModule, id: string) => void;

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function greeting() {
  const hour = Number(formatDate(Date.now(), { hour: "numeric", hour12: false }));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Quiet({ text }: { text: string }) {
  return <p className="home-quiet">{text}</p>;
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <SchoolDataBoundary
      fallback={(retry) => (
        <div role="alert" className="home-quiet">
          This section could not be loaded.{" "}
          <Button variant="link" className="h-auto p-0" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
    >
      {children}
    </SchoolDataBoundary>
  );
}

function CampusBanner() {
  const { account } = useSchool();
  const school = useRecords("home");
  const term = school.data.records[0]?.subtitle;
  const firstName = account?.name.split(" ")[0] ?? "";
  return (
    <div className="campus-banner">
      <img src={campus} width={1536} height={768} alt="Wynberg Girls Junior School campus" />
      <div className="banner-copy">
        <span className="term">
          <span>●</span> {term ? term.toUpperCase() : schoolConfig.shortName}
        </span>
        <h2>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h2>
        <p>Big moments. Everyday connections. Stay in the loop with your school day.</p>
      </div>
    </div>
  );
}

function SummaryCards() {
  const { role } = useSchool();
  const result = useDashboard();
  if (result.status === "error")
    return <Quiet text="Your school summary could not be loaded right now." />;
  if (result.status !== "ready")
    return (
      <div className="summary-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="home-skeleton" style={{ height: 77, margin: 0 }} />
        ))}
      </div>
    );
  const data = result.data;
  const staff = role !== "Parent";
  const cards: {
    label: string;
    value: string | number | null | undefined;
    icon: ComponentType<{ size?: number }>;
    to: "/messages" | "/calendar" | "/forms" | "/payments";
    tone: string;
  }[] = [
    {
      label: staff ? "Unread notices" : "Unread updates",
      value: data?.unread,
      icon: MessageSquare,
      to: "/messages",
      tone: "",
    },
    {
      label: "Upcoming events",
      value: data?.upcomingEvents,
      icon: CalendarDays,
      to: "/calendar",
      tone: "green",
    },
    {
      label: staff ? "Pending actions" : "Things to complete",
      value: data?.pendingActions,
      icon: ClipboardList,
      to: "/forms",
      tone: "gold",
    },
    {
      label: staff ? "Outstanding charges" : "Amount due",
      value:
        data?.amountDueCents === null || data?.amountDueCents === undefined
          ? null
          : money(data.amountDueCents / 100),
      icon: CreditCard,
      to: "/payments",
      tone: "",
    },
  ];
  return (
    <div className="summary-grid">
      {cards
        .filter((c) => c.value !== null && c.value !== undefined)
        .map((c) => (
          <Link key={c.label} to={c.to} className="summary-card">
            <div className={`summary-icon ${c.tone}`}>
              <c.icon size={20} />
            </div>
            <div>
              <strong>{c.value}</strong>
              <span>{c.label}</span>
            </div>
          </Link>
        ))}
    </div>
  );
}

function LatestUpdates({ onOpen }: { onOpen: OpenRecord }) {
  const [category, setCategory] = useState("");
  const result = useRecords("messages", category ? { category } : {});
  const notices = result.data.records.slice(0, 3);
  return (
    <>
      <div className="feed-tabs" role="tablist" aria-label="Update categories">
        {["", ...NOTICE_CATEGORIES].map((c) => (
          <Button
            key={c || "all"}
            role="tab"
            aria-selected={category === c}
            size="sm"
            variant={category === c ? "secondary" : "ghost"}
            onClick={() => setCategory(c)}
          >
            {c || "All updates"}
          </Button>
        ))}
      </div>
      {result.status === "loading" ? (
        <Placeholder rows={3} height={150} />
      ) : notices.length ? (
        notices.map((n) => (
          <NoticeCard key={n.id} notice={n} onOpen={() => onOpen("messages", n.id)} />
        ))
      ) : (
        <div className="empty-state">
          <MessageSquare size={28} />
          <h3>No updates here yet</h3>
          <p>New school notices will appear here as soon as they are published.</p>
        </div>
      )}
    </>
  );
}

function RecentEvents({ onOpen }: { onOpen: OpenRecord }) {
  const result = useRecords("calendar");
  const events = result.data.records.slice(-3).reverse();
  if (result.status === "loading") return <Placeholder rows={2} height={64} />;
  if (!events.length) return <Quiet text="No events on the school calendar yet." />;
  return (
    <>
      <p className="home-caption">No upcoming events yet. Recently on the calendar:</p>
      <div className="event-list is-past">
        {events.map((e) => (
          <EventRow key={e.id} event={e} onOpen={() => onOpen("calendar", e.id)} />
        ))}
      </div>
    </>
  );
}

function ComingUp({ onOpen }: { onOpen: OpenRecord }) {
  // Fixed per mount so the live query arguments stay stable across renders.
  const [from] = useState(startOfToday);
  const result = useRecords("calendar", { from });
  const events = result.data.records.slice(0, 4);
  const { canLoadMore, loadingMore, loadMore } = result;
  // Past events are filtered after paging, so keep paging until an upcoming event appears.
  useEffect(() => {
    if (events.length < 4 && canLoadMore && !loadingMore) loadMore();
  }, [events.length, canLoadMore, loadingMore, loadMore]);
  if (result.status === "loading" || (!events.length && canLoadMore))
    return <Placeholder rows={3} height={64} />;
  if (!events.length) return <RecentEvents onOpen={onOpen} />;
  return (
    <div className="event-list">
      {events.map((e) => (
        <EventRow key={e.id} event={e} onOpen={() => onOpen("calendar", e.id)} />
      ))}
    </div>
  );
}

function ActionList({
  module,
  onOpen,
  onCount,
}: {
  module: "forms" | "payments";
  onOpen: OpenRecord;
  onCount: (module: string, count: number) => void;
}) {
  const { role } = useSchool();
  const staff = role !== "Parent";
  const result = useRecords(module, module === "forms" ? { outstandingOnly: true } : {});
  const items = result.data.records.filter((r) => r.pending).slice(0, 3);
  const loading = result.status === "loading";
  useEffect(() => {
    if (!loading) onCount(module, items.length);
  }, [loading, items.length, module, onCount]);
  if (loading) return <Placeholder rows={1} height={110} />;
  return (
    <>
      {items.map((item) => (
        <div key={item.id} className={`action-item ${module === "payments" ? "payment" : ""}`}>
          <span className={`tag ${module === "forms" ? "gold" : "neutral"}`}>
            {module === "forms" ? <ClipboardList size={10} /> : <CreditCard size={10} />}
            {module === "forms"
              ? staff
                ? "OPEN CONSENT"
                : "CONSENT REQUIRED"
              : item.status.toUpperCase()}
          </span>
          <h3>{item.title}</h3>
          <p>
            {item.subtitle}
            {item.amountCents !== null && ` · ${money(item.amountCents / 100)}`}
            {item.at !== null && ` · Due ${formatDate(item.at, { day: "numeric", month: "long" })}`}
          </p>
          <Button variant="outline" onClick={() => onOpen(module, item.id)}>
            {module === "forms" ? (staff ? "View responses" : "Complete form") : "View payment"}
            <ArrowRight size={12} />
          </Button>
        </div>
      ))}
    </>
  );
}

function NeedsAttention({ onOpen }: { onOpen: OpenRecord }) {
  const { accessRoles, account } = useSchool();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const modules = (["forms", "payments"] as const).filter((m) =>
    canAccessModule(accessRoles, m, account?.disabledModules),
  );
  const report = useCallback(
    (m: string, n: number) => setCounts((c) => (c[m] === n ? c : { ...c, [m]: n })),
    [],
  );
  const total = modules.reduce((sum, m) => sum + (counts[m] ?? 0), 0);
  const settled = modules.every((m) => counts[m] !== undefined);
  if (!modules.length) return null;
  return (
    <section className="right-section">
      <div className="section-title">
        <h2>Needs your attention</h2>
        {total > 0 && (
          <span className="tag gold">
            {total} action{total === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {modules.map((m) => (
        <Section key={m}>
          <ActionList module={m} onOpen={onOpen} onCount={report} />
        </Section>
      ))}
      {settled && total === 0 && (
        <Quiet text="You're all caught up. Nothing needs your attention." />
      )}
    </section>
  );
}

function QuickLinks() {
  const { accessRoles, account } = useSchool();
  const allowed = (m: SchoolModule) => canAccessModule(accessRoles, m, account?.disabledModules);
  return (
    <section className="right-section">
      <div className="section-title">
        <h2>Quick links</h2>
      </div>
      <div className="quick-grid">
        {allowed("resources") && (
          <Link to="/resources" className="quick-link">
            <BookOpen />
            Resources
          </Link>
        )}
        {allowed("contact") && (
          <Link to="/contact" className="quick-link">
            <Mail />
            Contact school
          </Link>
        )}
        {allowed("children") && (
          <Link to="/children" className="quick-link">
            <FileText />
            School reports
          </Link>
        )}
        <a
          href={schoolConfig.clothingStoreUrl}
          target="_blank"
          rel="noreferrer"
          className="quick-link"
        >
          <Shirt />
          Uniform store
        </a>
      </div>
    </section>
  );
}

export function HomeDashboard({ onOpen }: { onOpen: OpenRecord }) {
  const { accessRoles, account } = useSchool();
  const allowed = (m: SchoolModule) => canAccessModule(accessRoles, m, account?.disabledModules);
  return (
    <>
      <Section>
        <CampusBanner />
      </Section>
      <Section>
        <SummaryCards />
      </Section>
      <div className="dashboard-grid">
        <section>
          <div className="section-title">
            <h2>Latest updates</h2>
            {allowed("messages") && (
              <Link to="/messages">
                View all <ArrowRight size={12} />
              </Link>
            )}
          </div>
          {allowed("messages") ? (
            <Section>
              <LatestUpdates onOpen={onOpen} />
            </Section>
          ) : (
            <Quiet text="School notices are not part of your account." />
          )}
        </section>
        <aside className="dashboard-aside">
          {allowed("calendar") && (
            <section className="right-section">
              <div className="section-title">
                <h2>Coming up</h2>
                <Link to="/calendar">
                  Calendar <ArrowRight size={12} />
                </Link>
              </div>
              <Section>
                <ComingUp onOpen={onOpen} />
              </Section>
            </section>
          )}
          <NeedsAttention onOpen={onOpen} />
          <QuickLinks />
        </aside>
      </div>
    </>
  );
}
