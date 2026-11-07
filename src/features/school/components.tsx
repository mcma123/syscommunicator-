import type { ReactNode } from "react";
import type { ModuleRecord } from "@school-connect/core/live";
import { Button } from "@/components/ui/button";
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
  title?: string;
  text?: string;
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
