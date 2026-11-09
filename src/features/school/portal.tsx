import { NotificationPanel } from "./notification-panel";
import { WorkflowPanel } from "./workflow-panel";
import { schoolConfig } from "@school-connect/core";
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
import { Heading, ChildPicker, Empty, RecordCard, Placeholder } from "./components";
import { AdList, AdPreview } from "./ads";
import { LearnerFolders } from "./learner-folders";
import { AdComposer, AdComposerLauncher } from "./ad-composer";
import {
  CalendarAgenda,
  CalendarMonth,
  LearnerGrid,
  MonthNavigator,
  NoticeList,
  PaymentsSummary,
  PaymentsTable,
  FormsList,
  ResourceList,
  EnquiryList,
  SchoolOffice,
} from "./module-views";
import { useRecords, useDetail, useReceipt, useSchool } from "./store";
import { HomeDashboard } from "./home";
import { CalendarDays, Search } from "lucide-react";
import { AccountManagement, PeopleInvitations } from "./account-management";
import { RosterImport } from "./roster-import";
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
  ads: "Ad Center",
};

const parentTitles: Partial<Record<SchoolModule, string>> = {
  contact: "Let's stay in touch",
  messages: "Your school updates",
  children: "My children",
  payments: "School payments",
};
const staffTitles: Partial<Record<SchoolModule, string>> = {
  contact: "School enquiry inbox",
  forms: "Forms & consent responses",
  messages: "School messages",
  children: "Your learners",
  payments: "Charges & payments",
};
const parentDescriptions: Partial<Record<SchoolModule, string>> = {
  messages: "The latest news, important notices and little moments.",
  calendar: "Make room for the moments that matter.",
  children: "Every milestone, all in one place.",
  payments: "School fees and activities, without the paperwork.",
  forms: "A few small things to keep their school day moving.",
  resources: "Newsletters, school documents and useful information.",
  contact: "The right people, just a message away.",
};
const staffDescriptions: Partial<Record<SchoolModule, string>> = {
  messages: "Review and share messages with your school community.",
  calendar: "Plan and share the moments that matter.",
  children: "Profiles, reports and attendance for the learners you support.",
  payments: "Track charges, payment status and history.",
  ads: "Share posters, pictures and short videos on parents' home screens.",
  forms: "Follow up on consent requests and family responses.",
  resources: "Publish and manage documents for your school community.",
  contact: "Reply to family enquiries and keep conversations moving.",
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
function DetailPanel({
  module,
  id,
  options,
  learnerId,
  initialTab,
}: {
  module: ReadModule;
  id: string;
  options: ReadOptions;
  learnerId?: string | undefined;
  initialTab?: string | undefined;
}) {
  const result = useDetail(module, id, options, learnerId);
  const receipt = useReceipt();
  const { offline } = useSchool();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [chosen, setSection] = useState<number>();
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
  const section =
    chosen ??
    Math.max(
      0,
      related.findIndex((tab) => tab.title === initialTab),
    );
  const current = related[section];
  return (
    <>
      <DialogTitle>{r.title}</DialogTitle>
      <DialogDescription>
        {r.subtitle} {r.status}
      </DialogDescription>
      {module === "ads" && (
        <>
          <AdPreview record={r} />
          <AdComposer adId={id} showPreview={false} />
        </>
      )}
      <WorkflowPanel
        module={module}
        itemId={id}
        learnerId={learnerId}
        hide={module === "ads" ? ["adSave"] : []}
      />
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
  const [mode, setMode] = useState<"agenda" | "month">("agenda");
  const [month, setMonth] = useState(() => schoolDate(Date.now()).slice(0, 7));
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState<{ id: string; tab?: string | undefined }>();
  const [manage, setManage] = useState(false);
  const { account } = useSchool();
  const staff = account?.roles.some((r) => ["Teacher", "Principal", "Administrator"].includes(r));
  const monthView = module === "calendar" && mode === "month";
  const range = monthView ? monthRange(month) : {};
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
  const open = (id: string, tab?: string) => setSelected({ id, tab });
  const records = result.data.records;
  const dayRows = monthView && day ? records.filter((r) => eventDays(r, month).includes(day)) : [];
  const styled =
    !compact &&
    [
      "messages",
      "calendar",
      "children",
      "payments",
      "paymentHistory",
      "forms",
      "resources",
      "contact",
      "ads",
      "classLearners",
    ].includes(module);
  const list = () => {
    if (!styled)
      return records.map((r) => <RecordCard key={r.id} record={r} onOpen={() => open(r.id)} />);
    if (module === "messages") return <NoticeList records={records} onOpen={open} />;
    if (module === "forms") return <FormsList records={records} onOpen={open} />;
    if (module === "resources") return <ResourceList records={records} onOpen={open} />;
    if (module === "contact") return <EnquiryList records={records} onOpen={open} />;
    if (module === "ads") return <AdList records={records} onOpen={open} />;
    if (module === "children" || module === "classLearners")
      return <LearnerGrid records={records} onOpen={open} />;
    if (module === "payments" || module === "paymentHistory")
      return (
        <PaymentsTable records={records} history={module === "paymentHistory"} onOpen={open} />
      );
    if (monthView)
      return (
        <>
          <CalendarMonth month={month} records={records} day={day} onDay={setDay} onOpen={open} />
          {day && (
            <section className="plain-section">
              <h2>
                {new Intl.DateTimeFormat("en-ZA", {
                  timeZone: "UTC",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(Date.parse(`${day}T12:00:00Z`))}
              </h2>
              {dayRows.length ? (
                <CalendarAgenda records={dayRows} onOpen={open} />
              ) : (
                <Empty title="A quiet day" text="No school events on this day." />
              )}
            </section>
          )}
        </>
      );
    return <CalendarAgenda records={records} onOpen={open} />;
  };
  return (
    <>
      {!compact && !["home", "settings"].includes(module) && (
        <div className="toolbar">
          <div className="search-field">
            <Search size={15} aria-hidden />
            <input
              aria-label="Search records"
              className="field"
              placeholder={
                module === "messages"
                  ? "Search updates..."
                  : module === "calendar"
                    ? "Search events..."
                    : module === "children" || module === "classLearners"
                      ? "Search learners..."
                      : module === "payments" || module === "paymentHistory"
                        ? "Search charges..."
                        : module === "forms"
                          ? "Search forms..."
                          : module === "resources"
                            ? "Search resources..."
                            : module === "contact"
                              ? "Search enquiries..."
                              : module === "ads"
                                ? "Search ads..."
                                : "Search records..."
              }
              maxLength={200}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {module === "forms" && (
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={outstanding}
                onChange={(e) => setOutstanding(e.target.checked)}
              />
              Outstanding only
            </label>
          )}
          {staff && ["messages", "calendar", "resources"].includes(module) && (
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={manage}
                onChange={(e) => setManage(e.target.checked)}
              />
              Show drafts & staff records
            </label>
          )}
          {module === "calendar" && (
            <div className="segmented" role="group" aria-label="Calendar view">
              {(["agenda", "month"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setDay("");
                  }}
                >
                  {m === "agenda" ? "Agenda" : "Month"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {(module === "messages" || module === "resources") && !compact && (
        <div className="feed-tabs" role="tablist" aria-label="Categories">
          {["", ...(module === "messages" ? NOTICE_CATEGORIES : RESOURCE_CATEGORIES)].map((c) => (
            <Button
              key={c || "all"}
              role="tab"
              aria-selected={category === c}
              size="sm"
              variant={category === c ? "secondary" : "ghost"}
              onClick={() => setCategory(c)}
            >
              {c || (module === "messages" ? "All updates" : "All resources")}
            </Button>
          ))}
        </div>
      )}
      {monthView && (
        <MonthNavigator
          month={month}
          onMove={(step) => {
            setMonth(moveMonth(month, step));
            setDay("");
          }}
          onToday={() => {
            setMonth(schoolDate(Date.now()).slice(0, 7));
            setDay(schoolDate(Date.now()));
          }}
        />
      )}
      {result.status === "loading" && !records.length && (
        <Placeholder rows={styled && module === "children" ? 2 : 3} height={styled ? 120 : 76} />
      )}
      {result.status === "ready" && !records.length && !monthView && (
        <Empty
          title={
            module === "messages"
              ? "No updates yet"
              : module === "calendar"
                ? "Nothing on the calendar"
                : module === "payments"
                  ? "No charges to show"
                  : module === "forms"
                    ? outstanding
                      ? "You're all caught up"
                      : "No forms right now"
                    : module === "resources"
                      ? "No resources yet"
                      : module === "contact"
                        ? "No enquiries yet"
                        : module === "ads"
                          ? "No ads yet"
                          : undefined
          }
          text={
            result.canLoadMore
              ? "No matches on these pages. Load more to continue searching."
              : search || category
                ? "Nothing matches your search. Try another word or category."
                : "No records match your account and selection."
          }
        />
      )}
      {(records.length > 0 || (monthView && result.status === "ready")) && list()}
      {(result.canLoadMore || result.loadingMore) && (
        <div className="load-more">
          <Button variant="outline" disabled={result.loadingMore} onClick={result.loadMore}>
            {result.loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(undefined);
        }}
      >
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto ${module === "ads" ? "sm:max-w-4xl" : ""}`}
        >
          {selected && (
            <Boundary key={selected.id}>
              <DetailPanel
                module={module}
                id={selected.id}
                options={options}
                learnerId={learnerId}
                initialTab={selected.tab}
              />
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
  const [importing, setImporting] = useState(false);
  const [opened, setOpened] = useState<{ module: ReadModule; id: string }>();
  const staff = (account?.roles.length ?? 0) > 0;
  const directory = [...navigation, ...staffNavigation].filter(
    (n) => canAccessModule(accessRoles, n.id, account?.disabledModules) && n.id !== "home",
  );
  return (
    <SchoolShell module={module}>
      <Heading
        title={(staff ? staffTitles[module] : parentTitles[module]) ?? titles[module]}
        description={
          module === "home"
            ? `Welcome, ${account?.name ?? ""}. Your school information updates automatically.`
            : ((staff ? staffDescriptions[module] : parentDescriptions[module]) ??
              "Information shared securely with your school account.")
        }
        action={
          module === "home" ? (
            <span className="date-label">
              <CalendarDays size={14} />
              {new Intl.DateTimeFormat("en-ZA", {
                timeZone: "Africa/Johannesburg",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(Date.now())}
            </span>
          ) : undefined
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
      ) : module === "home" ? (
        <>
          <WorkflowPanel module="home" />
          <HomeDashboard onOpen={(m, id) => setOpened({ module: m, id })} />
          <Dialog
            open={!!opened}
            onOpenChange={(v) => {
              if (!v) setOpened(undefined);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              {opened && (
                <Boundary key={`${opened.module}:${opened.id}`}>
                  <DetailPanel module={opened.module} id={opened.id} options={{}} />
                </Boundary>
              )}
            </DialogContent>
          </Dialog>
        </>
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
          {module === "contact" && (
            <Boundary>
              <SchoolOffice />
            </Boundary>
          )}
          {module === "ads" ? <AdComposerLauncher /> : <WorkflowPanel module={module} />}
          {module === "payments" && (
            <Boundary>
              <PaymentsSummary />
            </Boundary>
          )}
          {(module === "groups" || module === "payments" || module === "people") && (
            <div className="source-tabs" role="tablist">
              {(module === "groups"
                ? (["groups", "classes"] as const)
                : module === "people"
                  ? (["people", "invitations"] as const)
                  : (["payments", "paymentHistory"] as const)
              ).map((m) => (
                <Button
                  key={m}
                  role="tab"
                  aria-selected={source === m && !importing}
                  size="sm"
                  variant={source === m && !importing ? "secondary" : "ghost"}
                  onClick={() => {
                    setSource(m);
                    setImporting(false);
                  }}
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
              {module === "people" && account?.roles.includes("Administrator") && (
                <Button
                  role="tab"
                  aria-selected={importing}
                  size="sm"
                  variant={importing ? "secondary" : "ghost"}
                  onClick={() => setImporting(true)}
                >
                  Import roster
                </Button>
              )}
            </div>
          )}
          {module === "people" && importing ? (
            <Boundary key="people:import">
              <RosterImport />
            </Boundary>
          ) : module === "children" && staff ? (
            <LearnerFolders
              renderClass={(classId) => (
                <Boundary key={`class:${classId}`}>
                  <RecordBrowser module="classLearners" options={{ parentId: classId }} />
                </Boundary>
              )}
              renderSearch={() => (
                <Boundary key="children:all">
                  <RecordBrowser module="children" />
                </Boundary>
              )}
            />
          ) : (
            <Boundary key={`${module}:${source}`}>
              <RecordBrowser
                module={
                  module === "groups" || module === "payments" || module === "people"
                    ? source
                    : module
                }
              />
            </Boundary>
          )}
        </>
      )}
    </SchoolShell>
  );
}
