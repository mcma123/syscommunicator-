import type { ReactNode } from "react";
import type { ModuleRecord } from "@school-connect/core/live";
import { ArrowRight, Clock, MapPin, Paperclip, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, statusTone } from "./format";
import { useSchool } from "./store";
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ChildPicker() {
  const { account, child, setChild } = useSchool();
  return (
    <div className="child-picker">
      <label>Updates for</label>
      <Button
        size="sm"
        variant={child === "all" ? "default" : "outline"}
        onClick={() => setChild("all")}
      >
        All my children
      </Button>
      {account?.learners.map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant={child === c.id ? "default" : "outline"}
          onClick={() => setChild(c.id)}
        >
          {c.name}
        </Button>
      ))}
    </div>
  );
}
export function Empty({
  title = "Nothing here just yet",
  text = "There are no matching records for your account.",
}: {
  title?: string | undefined;
  text?: string | undefined;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function RecordCard({ record, onOpen }: { record: ModuleRecord; onOpen?: () => void }) {
  return (
    <article className="notice-card">
      <div className="notice-top">
        <span className="tag neutral">{record.status || record.subtitle}</span>
        {record.at !== null && (
          <span className="notice-date">
            {new Date(record.at).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}
          </span>
        )}
      </div>
      <h3>{record.title}</h3>
      <p className="notice-author">{record.subtitle}</p>
      <p className="body-excerpt whitespace-pre-wrap">{record.body}</p>
      {record.amountCents !== null && (
        <strong>
          {new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
            record.amountCents / 100,
          )}
        </strong>
      )}
      {onOpen && (
        <div className="notice-footer">
          <span>
            {record.canAcknowledge || record.canMarkRead
              ? record.acknowledged
                ? "Acknowledged"
                : record.read
                  ? "Read"
                  : "Unread"
              : ""}
          </span>
          <Button variant="link" onClick={onOpen}>
            View details
          </Button>
        </div>
      )}
    </article>
  );
}

export function StatusTag({ status }: { status: string }) {
  return status ? <span className={`tag ${statusTone(status)}`}>{status}</span> : null;
}

export function Placeholder({ rows = 3, height = 76 }: { rows?: number; height?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="home-skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function NoticeCard({ notice, onOpen }: { notice: ModuleRecord; onOpen: () => void }) {
  const attachment = notice.fields?.find((f) => f.label === "Attachment")?.value;
  const tone =
    notice.category === "Sport" ? "green" : notice.category === "General" ? "neutral" : "";
  return (
    <article className="notice-card">
      <div className="notice-top">
        <div className="notice-badges">
          {notice.category && <span className={`tag ${tone}`}>{notice.category}</span>}
          {notice.requiresAcknowledgement && !notice.acknowledged && (
            <span className="tag gold">Please acknowledge</span>
          )}
          {notice.canMarkRead && !notice.read && <span className="notice-new">● NEW</span>}
        </div>
        {notice.at !== null && (
          <span className="notice-date">
            {formatDate(notice.at, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      <h3>{notice.title}</h3>
      <p className="body-excerpt">{notice.body}</p>
      {attachment && (
        <div className="notice-attachment">
          <Paperclip size={12} />
          <span className="truncate">{attachment}</span>
        </div>
      )}
      <div className="notice-footer">
        <span className="notice-author">
          <UserRound size={12} />
          {notice.subtitle}
        </span>
        <Button variant="link" onClick={onOpen}>
          {notice.requiresAcknowledgement && !notice.acknowledged ? "Read & respond" : "Read more"}
          <ArrowRight size={12} />
        </Button>
      </div>
    </article>
  );
}

export function EventRow({
  event,
  onOpen,
  past = false,
}: {
  event: ModuleRecord;
  onOpen: () => void;
  past?: boolean;
}) {
  const at = event.at ?? Date.now();
  const time = event.allDay
    ? "All day"
    : `${formatDate(at, { hour: "2-digit", minute: "2-digit" })}${
        event.endsAt ? ` – ${formatDate(event.endsAt, { hour: "2-digit", minute: "2-digit" })}` : ""
      }`;
  return (
    <button type="button" className={`event-row ${past ? "is-past" : ""}`} onClick={onOpen}>
      <div className="event-date">
        <strong>{formatDate(at, { day: "numeric" })}</strong>
        <span>{formatDate(at, { month: "short" }).toUpperCase()}</span>
      </div>
      <div className="event-info">
        <h3>{event.title}</h3>
        <p>
          <Clock size={10} />
          {formatDate(at, { weekday: "short" })} · {time}
        </p>
        {event.subtitle && (
          <p>
            <MapPin size={10} />
            {event.subtitle}
          </p>
        )}
      </div>
    </button>
  );
}
