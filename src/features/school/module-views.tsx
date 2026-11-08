import {
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Info,
  ReceiptText,
  Wallet,
  CalendarClock,
  ArrowRight,
  Building2,
  ClipboardList,
  File,
  ImageIcon,
  Mail,
  MessagesSquare,
  Phone,
} from "lucide-react";
import type { ModuleRecord } from "@school-connect/core/live";
import { eventDays, monthCells, schoolDate } from "@school-connect/core/calendar";
import { Button } from "@/components/ui/button";
import { EventRow, NoticeCard, StatusTag } from "./components";
import { formatDate, formatMoney } from "./format";
import { useDashboard, useRecords, useSchool } from "./store";

/** Opens a record; `tab` preselects a related-information tab by title. */
export type OpenItem = (id: string, tab?: string) => void;

const monthLabel = (month: string) =>
  formatDate(Date.parse(`${month}-15T12:00:00Z`), { month: "long", year: "numeric" });

export function NoticeList({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  return (
    <>
      {records.map((n) => (
        <NoticeCard key={n.id} notice={n} onOpen={() => onOpen(n.id)} />
      ))}
    </>
  );
}

export function MonthNavigator({
  month,
  onMove,
  onToday,
}: {
  month: string;
  onMove: (step: number) => void;
  onToday: () => void;
}) {
  return (
    <div className="month-nav">
      <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => onMove(-1)}>
        <ChevronLeft />
      </Button>
      <h2>{monthLabel(month)}</h2>
      <Button variant="outline" size="icon" aria-label="Next month" onClick={() => onMove(1)}>
        <ChevronRight />
      </Button>
      <Button variant="ghost" size="sm" onClick={onToday}>
        Today
      </Button>
    </div>
  );
}

export function CalendarMonth({
  month,
  records,
  day,
  onDay,
  onOpen,
}: {
  month: string;
  records: ModuleRecord[];
  day: string;
  onDay: (day: string) => void;
  onOpen: OpenItem;
}) {
  const today = schoolDate(Date.now());
  return (
    <div className="calendar-grid" role="grid" aria-label={monthLabel(month)}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <div className="calendar-cell header" role="columnheader" key={d}>
          {d}
        </div>
      ))}
      {monthCells(month).map((date, i) => {
        if (!date) return <div key={`blank-${i}`} className="calendar-cell blank" />;
        const events = records.filter((r) => eventDays(r, month).includes(date));
        return (
          <div
            key={date}
            role="gridcell"
            aria-selected={day === date}
            className={`calendar-cell ${date === today ? "today" : ""} ${day === date ? "selected" : ""}`}
          >
            <button
              type="button"
              className="calendar-day"
              aria-label={`${formatDate(Date.parse(`${date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long" })}${events.length ? `, ${events.length} event${events.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={day === date}
              onClick={() => onDay(day === date ? "" : date)}
            >
              {Number(date.slice(-2))}
            </button>
            {events.slice(0, 3).map((e) => (
              <button
                type="button"
                key={e.id}
                className="calendar-chip"
                title={e.title}
                onClick={() => onOpen(e.id)}
              >
                {!e.allDay && e.at !== null && (
                  <span>{formatDate(e.at, { hour: "2-digit", minute: "2-digit" })}</span>
                )}
                {e.title}
              </button>
            ))}
            {events.length > 3 && (
              <button type="button" className="calendar-more" onClick={() => onDay(date)}>
                +{events.length - 3} more
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CalendarAgenda({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  const now = Date.now();
  const groups = new Map<string, ModuleRecord[]>();
  for (const r of records) {
    const key =
      r.at === null ? "Date to be confirmed" : formatDate(r.at, { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <>
      {[...groups].map(([label, events]) => (
        <section className="agenda-group" key={label}>
          <h2 className="agenda-month">
            <CalendarDays size={14} />
            {label}
          </h2>
          <div className="event-list">
            {events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                past={(e.endsAt ?? e.at ?? now) < now}
                onOpen={() => onOpen(e.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export function LearnerGrid({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  return (
    <div className="learner-grid">
      {records.map((l) => {
        const field = (label: string) => {
          const value = l.fields?.find((f) => f.label === label)?.value;
          return value && value !== "Not provided" ? value : null;
        };
        const [grade, className] = l.subtitle.split("|").map((p) => p.trim());
        return (
          <article className="record-card learner-card" key={l.id}>
            <div className="learner-card-top">
              <div className="avatar">{initials(l.title)}</div>
              <div className="min-w-0">
                <h2>{l.title}</h2>
                <div className="notice-badges">
                  {grade && <span className="tag">{grade}</span>}
                  {className && <span className="tag neutral">Class {className}</span>}
                </div>
              </div>
              <StatusTag status={l.status} />
            </div>
            <div className="record-details">
              <div>
                <span>Class teacher</span>
                {field("Class teacher") ?? "Not assigned"}
              </div>
              <div>
                <span>Learner number</span>
                {field("Learner number") ?? "—"}
              </div>
              <div>
                <span>Preferred name</span>
                {field("Preferred name") ?? l.title.split(" ")[0]}
              </div>
              <div>
                <span>Birth date</span>
                {field("Birth date") ?? "—"}
              </div>
            </div>
            <div className="learner-actions">
              <Button variant="outline" size="sm" onClick={() => onOpen(l.id, "Reports")}>
                <FileText />
                Reports
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpen(l.id, "Attendance")}>
                <ClipboardCheck />
                Attendance
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpen(l.id, "Conduct")}>
                <Award />
                Conduct
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpen(l.id, "Timetable")}>
                <GraduationCap />
                Timetable
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PaymentsTable({
  records,
  history,
  onOpen,
}: {
  records: ModuleRecord[];
  history: boolean;
  onOpen: OpenItem;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{history ? "Payment" : "Charge"}</th>
            <th>{history ? "Learner · method" : "Learner"}</th>
            <th>{history ? "Date" : "Due date"}</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const overdue = !history && r.pending && r.at !== null && r.at < Date.now();
            return (
              <tr key={r.id}>
                <td>
                  <strong className="table-title">{r.title}</strong>
                  {r.body && <span className="table-sub">{r.body}</span>}
                </td>
                <td>
                  {r.subtitle
                    .split("|")
                    .map((p) => p.trim())
                    .join(" · ")}
                </td>
                <td>
                  {r.at === null
                    ? "—"
                    : formatDate(r.at, { day: "numeric", month: "short", year: "numeric" })}
                  {overdue && <span className="table-sub overdue">Overdue</span>}
                </td>
                <td className="text-right tabular-nums">
                  {r.amountCents === null ? "—" : formatMoney(r.amountCents)}
                </td>
                <td>
                  <StatusTag status={r.status} />
                </td>
                <td className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onOpen(r.id)}>
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsSummary() {
  const { role } = useSchool();
  const dashboard = useDashboard();
  const charges = useRecords("payments");
  const open = charges.data.records.filter((r) => r.pending);
  const next = open.filter((r) => r.at !== null).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))[0];
  const due = dashboard.status === "ready" ? dashboard.data?.amountDueCents : undefined;
  const loading = dashboard.status !== "ready" || charges.status === "loading";
  return (
    <>
      <div className="summary-grid payments-summary">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="home-skeleton" style={{ height: 77, margin: 0 }} />
          ))
        ) : (
          <>
            <div className="summary-card">
              <div className="summary-icon">
                <Wallet size={20} />
              </div>
              <div>
                <strong>{due === null || due === undefined ? "—" : formatMoney(due)}</strong>
                <span>{role === "Parent" ? "Amount due" : "Outstanding in your scope"}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon gold">
                <ReceiptText size={20} />
              </div>
              <div>
                <strong>
                  {open.length}
                  {charges.canLoadMore ? "+" : ""}
                </strong>
                <span>Open charges</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon green">
                <CalendarClock size={20} />
              </div>
              <div>
                <strong>
                  {next?.at ? formatDate(next.at, { day: "numeric", month: "short" }) : "—"}
                </strong>
                <span>
                  {next
                    ? `${(next.at ?? 0) < Date.now() ? "Overdue" : "Next due"} · ${next.title}`
                    : "Nothing due"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="status-banner payments-note" role="note">
        <Info size={15} />
        Online payments are not available yet. Charges and payment history are shown for your
        information.
      </p>
    </>
  );
}

const isOverdue = (r: ModuleRecord) => !!r.pending && r.at !== null && r.at < Date.now();

function FormCard({
  form,
  onOpen,
  staff,
}: {
  form: ModuleRecord;
  onOpen: OpenItem;
  staff: boolean;
}) {
  const overdue = isOverdue(form);
  return (
    <article className={`notice-card form-card ${form.pending ? "is-pending" : ""}`}>
      <div className="notice-top">
        <div className="notice-badges">
          <span className="tag neutral">
            <ClipboardList size={10} />
            {form.subtitle || "Form"}
          </span>
          <StatusTag status={form.status} />
          {overdue && !staff && <span className="tag">Past due</span>}
        </div>
        {form.at !== null && (
          <span className={`notice-date ${overdue ? "overdue" : ""}`}>
            Due {formatDate(form.at, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      <h3>{form.title}</h3>
      {form.body && <p className="body-excerpt">{form.body}</p>}
      <div className="notice-footer">
        <span className="notice-author">
          {form.pending
            ? staff
              ? "Responses still outstanding"
              : "Your response is needed"
            : "Response received. Thank you."}
        </span>
        <Button
          variant={form.pending && !staff ? "default" : "link"}
          size={form.pending && !staff ? "sm" : "default"}
          className={form.pending && !staff ? "notice-cta" : undefined}
          onClick={() => onOpen(form.id)}
        >
          {staff ? "View responses" : form.pending ? "Complete form" : "View response"}
          <ArrowRight size={12} />
        </Button>
      </div>
    </article>
  );
}

export function FormsList({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  const { role } = useSchool();
  const staff = role !== "Parent";
  const pending = records.filter((r) => r.pending);
  const done = records.filter((r) => !r.pending);
  const group = (title: string, items: ModuleRecord[], hint: string) =>
    items.length > 0 && (
      <section className="agenda-group">
        <h2 className="agenda-month">
          {title}
          <span className="group-count">{items.length}</span>
        </h2>
        <p className="home-caption">{hint}</p>
        {items.map((f) => (
          <FormCard key={f.id} form={f} onOpen={onOpen} staff={staff} />
        ))}
      </section>
    );
  return (
    <>
      {group(
        staff ? "Open requests" : "To complete",
        pending,
        staff ? "Families have not all responded yet." : "These need a response from you.",
      )}
      {group(
        staff ? "Fully responded" : "Completed",
        done,
        staff ? "Every family in scope has responded." : "Forms you have already submitted.",
      )}
    </>
  );
}

const fileSize = (raw?: string) => {
  const bytes = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(bytes)) return null;
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileKind = (type?: string, name?: string) => {
  const source = `${type ?? ""} ${name ?? ""}`.toLowerCase();
  if (source.includes("pdf")) return { label: "PDF", tone: "", icon: FileText };
  if (/image|\.png|\.jpe?g|\.webp/.test(source))
    return { label: "Image", tone: "green", icon: ImageIcon };
  return { label: "Document", tone: "gold", icon: File };
};

export function ResourceList({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  return (
    <div className="resource-list">
      {records.map((r) => {
        const value = (label: string) => r.fields?.find((f) => f.label === label)?.value;
        const kind = fileKind(value("Type"), value("File"));
        const size = fileSize(value("Size"));
        return (
          <div className="resource-row" key={r.id}>
            <div className={`summary-icon ${kind.tone}`}>
              <kind.icon size={20} />
            </div>
            <div className="min-w-0">
              <h3>{r.title}</h3>
              {r.body && <p className="resource-description">{r.body}</p>}
              <p>
                {[
                  r.category ?? r.subtitle,
                  kind.label,
                  size,
                  r.at !== null
                    ? `Updated ${formatDate(r.at, { day: "numeric", month: "short", year: "numeric" })}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {r.status && r.status !== "Published" && <StatusTag status={r.status} />}
            <Button variant="outline" size="sm" onClick={() => onOpen(r.id)}>
              Open
              <ArrowRight size={12} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function EnquiryList({ records, onOpen }: { records: ModuleRecord[]; onOpen: OpenItem }) {
  return (
    <>
      {records.map((e) => (
        <article className="notice-card" key={e.id}>
          <div className="notice-top">
            <div className="notice-badges">
              {e.subtitle && <span className="tag">{e.subtitle}</span>}
              <StatusTag status={e.status} />
            </div>
            {e.at !== null && (
              <span className="notice-date">
                Last message {formatDate(e.at, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <h3>{e.title}</h3>
          <div className="notice-footer">
            <span className="notice-author">
              <MessagesSquare size={12} />
              Conversation with {e.subtitle || "the school"}
            </span>
            <Button variant="link" onClick={() => onOpen(e.id)}>
              Open conversation
              <ArrowRight size={12} />
            </Button>
          </div>
        </article>
      ))}
    </>
  );
}

export function SchoolOffice() {
  const school = useRecords("home");
  const record = school.data.records[0];
  const value = (label: string) => {
    const v = record?.fields?.find((f) => f.label === label)?.value;
    return v && v !== "Not provided" ? v : null;
  };
  const email = value("Email");
  const phone = value("Phone");
  return (
    <section className="office-card" aria-label="School office">
      <div className="summary-icon">
        <Building2 size={20} />
      </div>
      <div className="office-copy">
        <h2>{record?.title ?? "School office"}</h2>
        <p>
          Questions about your child or the school? Choose School actions below to send an enquiry,
          and the right team will reply here.
        </p>
      </div>
      <div className="office-contacts">
        {school.status === "loading" ? (
          <span className="home-caption">Loading contact details...</span>
        ) : (
          <>
            {email ? (
              <a className="office-contact" href={`mailto:${email}`}>
                <Mail size={15} />
                {email}
              </a>
            ) : (
              <span className="office-contact is-missing">
                <Mail size={15} />
                Email awaiting confirmation
              </span>
            )}
            {phone ? (
              <a className="office-contact" href={`tel:${phone.replace(/\s+/g, "")}`}>
                <Phone size={15} />
                {phone}
              </a>
            ) : (
              <span className="office-contact is-missing">
                <Phone size={15} />
                Phone awaiting confirmation
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
