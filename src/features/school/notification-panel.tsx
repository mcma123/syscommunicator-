import { useState } from "react";
import { useNotifications, useSchool } from "./store";
import { Button } from "@/components/ui/button";
export function NotificationPanel({ noticeId }: { noticeId?: string }) {
  const result = useNotifications(noticeId),
    { offline } = useSchool();
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section className="record-card my-4 grid gap-3">
      <h3>{noticeId ? "Notification delivery" : "Your notifications"}</h3>
      {!noticeId && result.configuration && (
        <p className="text-sm text-muted-foreground">
          {result.configuration.enabled
            ? "School delivery is enabled."
            : "The school is setting up notifications."}{" "}
          {result.configuration.emailConfigured
            ? "Email service configured."
            : "School email delivery is being set up."}{" "}
          Registered phones: {result.configuration.registeredDevices}. Phone push setup is available
          in the Android/iOS app.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Accepted means the provider received the request. Confirmed means Expo handed it to
        Apple/Google, or the email provider confirmed delivery; it does not prove the phone
        displayed it. Read and acknowledged are tracked separately.
      </p>
      {result.error && <p role="alert">Notification status is unavailable. Reload to try again.</p>}
      {result.loading && <p role="status">Loading notification history...</p>}
      {!result.loading && !result.records.length && <p>No notification deliveries recorded yet.</p>}
      {result.records.map((row) => (
        <div className="border-t pt-3 grid gap-1" key={row.id}>
          <strong>
            {row.name} · {row.channel} ·{" "}
            {row.state === "Delivered" ? "Provider confirmed" : row.state}
          </strong>
          <span>{row.kind === "Notice" ? "School update" : "Consent reminder"}</span>
          {row.reason && <p>{row.reason}</p>}
          {row.canRetry && (
            <label className="text-sm flex gap-2 items-center">
              <input
                type="checkbox"
                aria-label={`Confirm retry ${row.id}`}
                disabled={offline || !!busy}
                onChange={(e) => {
                  if (!e.target.checked) return;
                  e.target.checked = false;
                  setBusy(row.id);
                  setMessage("");
                  void result
                    .retry({ deliveryId: row.id })
                    .then(() =>
                      setMessage(
                        "Retry requested. Current preferences and access will be checked again.",
                      ),
                    )
                    .catch(() =>
                      setMessage("Could not request a retry. Check permissions and connection."),
                    )
                    .finally(() => setBusy(""));
                }}
              />
              Retry this delivery (a failed push may already have arrived)
            </label>
          )}
        </div>
      ))}
      {(result.canLoadMore || result.loadingMore) && (
        <Button variant="outline" disabled={result.loadingMore} onClick={result.loadMore}>
          Load more delivery records
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
