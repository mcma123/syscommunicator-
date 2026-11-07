import { NotificationPanel } from "./notification-panel";
import { WorkflowPanel } from "./workflow-panel";
import { schoolConfig, money } from "@school-connect/core";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { SchoolModule } from "@school-connect/core/permissions";
import { canAccessModule } from "@school-connect/core/permissions";
import type {
  ReadModule,
  ReadOptions,
  RecordDetail,
  ModuleRecord,
} from "@school-connect/core/live";
import { NOTICE_CATEGORIES, RESOURCE_CATEGORIES } from "@school-connect/core/domain";
import {
  monthCells,
  monthRange,
  moveMonth,
  schoolDate,
  eventDays,
  eventIcs,
} from "@school-connect/core/calendar";
import { SchoolDataBoundary } from "@school-connect/backend/react";
import type { Id } from "@school-connect/backend/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SchoolShell, navigation, staffNavigation } from "./shell";
import { Heading, ChildPicker, Empty, RecordCard } from "./components";
import { useRecords, useDetail, useDashboard, useReceipt, useSchool } from "./store";
import { AccountManagement, PeopleInvitations } from "./account-management";
const titles: Record<SchoolModule, string> = {
  home: "Your school, connected",
  messages: "School updates",
  calendar: "School calendar",
  children: "Learners",
  resources: "Resources",
  payments: "Payments",
  forms: "Forms & consent",
  contact: "Contact school",
  more: "More from your school",
  profile: "Your profile",
  groups: "Groups & classes",
  attendance: "Attendance",
  conduct: "Learner conduct",
  reports: "Learner reports",
  people: "People & invitations",
  settings: "School settings",
  audit: "Audit log",
};

function Failure({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="status-banner">
      This information could not be loaded.{" "}
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
function Boundary({ children }: { children: React.ReactNode }) {
  return (
    <SchoolDataBoundary fallback={(retry) => <Failure retry={retry} />}>
      {children}
    </SchoolDataBoundary>
  );
}
function exportEvent(record: ModuleRecord) {
  const blob = new Blob([eventIcs(record, Date.now())], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "school-event.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Dashboard() {
  const result = useDashboard();
  return result.status === "error" ? (
    <Failure retry={result.retry} />
  ) : result.status !== "ready" ? (
    <p role="status">Updating your school summary...</p>
  ) : (
    <div className="module-grid mb-6">
      {[
        ["Unread updates", result.data?.unread],
        ["Pending actions", result.data?.pendingActions],
        ["Upcoming events", result.data?.upcomingEvents],
        [
          "Amount due",
          result.data?.amountDueCents === null
            ? null
            : money((result.data?.amountDueCents ?? 0) / 100),
        ],
      ]
        .filter(([, v]) => v !== null)
        .map(([label, value]) => (
          <div className="record-card" key={label}>
            <p>{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
    </div>
  );
}
function DetailPanel({
  module,
  id,
  options,
  learnerId,
}: {
  module: ReadModule;
  id: string;
  options: ReadOptions;
  learnerId?: string | undefined;
}) {
  const result = useDetail(module, id, options, learnerId);
  const receipt = useReceipt();
  const { offline } = useSchool();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [section, setSection] = useState(0);
  const r = result.data?.record;
  async function save(acknowledge: boolean) {
    if (!r || offline) return;
    setBusy(true);
    setFailure("");
    try {
      await receipt({ noticeId: r.id as Id<"notices">, acknowledge });
    } catch {
      setFailure("Could not save your response. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (result.status === "error")
    return (
      <>
        <DialogTitle>Record unavailable</DialogTitle>
        <DialogDescription>
          This record may no longer be available for your account and selection.
        </DialogDescription>
        <Failure retry={result.retry} />
      </>
    );
  if (!r)
    return (
      <>
        <DialogTitle>Loading record</DialogTitle>
        <DialogDescription>Please wait...</DialogDescription>
      </>
    );
  const related = result.data?.related ?? [];
  const current = related[section];
  return (
    <>
      <DialogTitle>{r.title}</DialogTitle>
      <DialogDescription>
        {r.subtitle} {r.status}
      </DialogDescription>
      <WorkflowPanel module={module} itemId={id} learnerId={learnerId} />
      {module === "messages" && related.some((r) => r.module === "noticeReceipts") && (
        <Boundary>
          <NotificationPanel noticeId={id} />
        </Boundary>
      )}
      <div className="modal-body whitespace-pre-wrap">{r.body}</div>
      {r.fields?.map((f, i) => (
        <p key={i}>
          <strong>{f.label}: </strong>
          {f.value}
        </p>
      ))}
      {module === "messages" && r.canMarkRead && (
        <div className="flex gap-2">
          <Button disabled={offline || busy || r.read} onClick={() => void save(false)}>
            {r.read ? "Read" : "Mark as read"}
          </Button>
          {r.requiresAcknowledgement && r.canAcknowledge && (
            <Button disabled={offline || busy || r.acknowledged} onClick={() => void save(true)}>
              {r.acknowledged ? "Acknowledged" : "Acknowledge"}
            </Button>
          )}
        </div>
      )}

      {module === "calendar" && (
        <Button
          onClick={() => {
            try {
              exportEvent(r);
            } catch {
              setFailure("Could not export this event.");
            }
          }}
        >
          Add to calendar (.ics)
        </Button>
      )}
      {failure && <p role="alert">{failure}</p>}
      {related.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Related information">
            {related.map((tab, i) => (
              <Button
                key={tab.module}
                role="tab"
                aria-selected={section === i}
                variant={section === i ? "default" : "outline"}
                onClick={() => setSection(i)}
              >
                {tab.title}
              </Button>
            ))}
          </div>
          {current && (
            <Boundary key={`${current.module}:${r.id}`}>
              <RecordBrowser
                module={current.module}
                options={{ ...(current.parentId ? { parentId: current.parentId } : {}) }}
                learnerId={current.learnerId}
                compact
              />
            </Boundary>
          )}
        </>
      )}
    </>
  );
}
export function RecordBrowser({
  module,
  options = {},
  learnerId,
  compact = false,
}: {
  module: ReadModule;
  options?: ReadOptions;
  learnerId?: string | undefined;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outstanding, setOutstanding] = useState(false);
  const [mode, setMode] = useState("agenda");
  const [month, setMonth] = useState(() => schoolDate(Date.now()).slice(0, 7));
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<string>();
  const [manage, setManage] = useState(false);
  const { account } = useSchool();
  const staff = account?.roles.some((r) => ["Teacher", "Principal", "Administrator"].includes(r));
  const range = module === "calendar" && mode === "month" ? monthRange(month) : {};
  const result = useRecords(
    module,
    {
      ...options,
      ...range,
      ...(manage ? { manage: true } : {}),
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(outstanding ? { outstandingOnly: true } : {}),
    },
    learnerId,
  );
  const categories =
    module === "messages" ? NOTICE_CATEGORIES : module === "resources" ? RESOURCE_CATEGORIES : [];
  const rows = result.data.records.filter(
    (r) => !day || module !== "calendar" || mode !== "month" || eventDays(r, month).includes(day),
  );
  return (
    <>
      {!compact && !["home", "settings"].includes(module) && (
        <div className="toolbar flex-wrap">
          <input
            aria-label="Search records"
            className="field"
            placeholder="Search records..."
            maxLength={200}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {categories.length > 0 && (
            <select
              aria-label="Category"
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {module === "forms" && (
            <label>
              <input
                type="checkbox"
                checked={outstanding}
                onChange={(e) => setOutstanding(e.target.checked)}
              />{" "}
              Outstanding only
            </label>
          )}
        </div>
      )}
      {staff && ["messages", "calendar", "resources"].includes(module) && (
        <label className="block my-3">
          <input type="checkbox" checked={manage} onChange={(e) => setManage(e.target.checked)} />{" "}
          Show staff workflow records
        </label>
      )}
      {module === "calendar" && (
        <>
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === "agenda" ? "default" : "outline"}
              onClick={() => {
                setMode("agenda");
                setDay("");
              }}
            >
              Agenda
            </Button>
            <Button
              variant={mode === "month" ? "default" : "outline"}
              onClick={() => setMode("month")}
            >
              Month
            </Button>
          </div>
          {mode === "month" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <Button
                  variant="outline"
                  aria-label="Previous month"
                  onClick={() => {
                    setMonth(moveMonth(month, -1));
                    setDay("");
                  }}
                >
                  Previous
                </Button>
                <strong>{month}</strong>
                <Button
                  variant="outline"
                  aria-label="Next month"
                  onClick={() => {
                    setMonth(moveMonth(month, 1));
                    setDay("");
                  }}
                >
                  Next
                </Button>
                <Button variant="ghost" onClick={() => setDay("")}>
                  All days
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span className="text-center text-xs" key={d}>
                    {d}
                  </span>
                ))}
                {monthCells(month).map((date, i) =>
                  date ? (
                    <Button
                      key={date}
                      aria-label={date}
                      aria-pressed={day === date}
                      variant={day === date ? "default" : "outline"}
                      onClick={() => setDay(date)}
                    >
                      {Number(date.slice(-2))}
                      {result.data.records.some((r) => eventDays(r, month).includes(date))
                        ? " *"
                        : ""}
                    </Button>
                  ) : (
                    <span key={`blank-${i}`} />
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
      {result.status === "loading" && <p role="status">Loading your school information...</p>}
      {result.status === "ready" && !rows.length && (
        <Empty
          text={
            result.canLoadMore
              ? "No matches on these pages. Load more to continue searching."
              : "No records match your account and selection."
          }
        />
      )}
      {rows.map((r) => (
        <RecordCard key={r.id} record={r} onOpen={() => setSelected(r.id)} />
      ))}
      {(result.canLoadMore || result.loadingMore) && (
        <Button
          className="my-4"
          variant="outline"
          disabled={result.loadingMore}
          onClick={result.loadMore}
        >
          {result.loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selected && (
            <Boundary key={selected}>
              <DetailPanel module={module} id={selected} options={options} learnerId={learnerId} />
            </Boundary>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SchoolPortal({ module }: { module: SchoolModule }) {
  const { account, accessRoles } = useSchool();
  const [source, setSource] = useState<ReadModule>(module);
  const directory = [...navigation, ...staffNavigation].filter(
    (n) => canAccessModule(accessRoles, n.id, account?.disabledModules) && n.id !== "home",
  );
  return (
    <SchoolShell module={module}>
      <Heading
        title={titles[module]}
        description={
          module === "home"
            ? `Welcome, ${account?.name ?? ""}. Your school information updates automatically.`
            : "Information shared securely with your school account."
        }
      />
      {!!account?.learners.length && <ChildPicker />}
      {module === "more" ? (
        <div className="module-grid">
          {directory.map((n) => (
            <Link className="quick-link" to={n.path} key={n.id}>
              <n.icon />
              {n.name}
            </Link>
          ))}
          <Link className="quick-link" to="/profile">
            Your profile
          </Link>
          <a
            className="quick-link"
            href={schoolConfig.clothingStoreUrl}
            target="_blank"
            rel="noreferrer"
          >
            Uniform store
          </a>
        </div>
      ) : module === "profile" ? (
        <>
          <div className="record-card">
            <h2>{account?.name}</h2>
            <p>{account?.email}</p>
            <p>{accessRoles.join(" | ")}</p>
            <p>{account?.learners.map((l) => l.name).join(", ")}</p>
          </div>
          <WorkflowPanel module="profile" />
          <Boundary>
            <NotificationPanel />
          </Boundary>
          <AccountManagement />
        </>
      ) : (
        <>
          <WorkflowPanel module={module} />
          {module === "home" && (
            <Boundary>
              <Dashboard />
            </Boundary>
          )}
          {(module === "groups" || module === "payments" || module === "people") && (
            <div className="flex gap-2 mb-4">
              {(module === "groups"
                ? (["groups", "classes"] as const)
                : module === "people"
                  ? (["people", "invitations"] as const)
                  : (["payments", "paymentHistory"] as const)
              ).map((m) => (
                <Button
                  key={m}
                  variant={source === m ? "default" : "outline"}
                  onClick={() => setSource(m)}
                >
                  {m === "people"
                    ? "Accounts"
                    : m === "invitations"
                      ? "Invitations"
                      : m === "paymentHistory"
                        ? "Payment history"
                        : m === "payments"
                          ? "Charges"
                          : m === "classes"
                            ? "Classes"
                            : "Groups"}
                </Button>
              ))}
            </div>
          )}
          <Boundary key={`${module}:${source}`}>
            <RecordBrowser
              module={
                module === "groups" || module === "payments" || module === "people"
                  ? source
                  : module
              }
            />
          </Boundary>
        </>
      )}
    </SchoolShell>
  );
}
