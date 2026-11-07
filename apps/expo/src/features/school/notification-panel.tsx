import { useState } from "react";
import { Linking, Platform } from "react-native";
import { useNotifications, useSchool } from "./store";
import { Button, Card, Feedback, Text } from "./ui";
export function NotificationPanel({ noticeId }: { noticeId?: string }) {
  const result = useNotifications(noticeId),
    school = useSchool();
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <Card>
      <Text weight="bold">{noticeId ? "Notification delivery" : "Your notifications"}</Text>
      {!noticeId && (
        <>
          {Platform.OS !== "web" && (
            <>
              <Feedback message={school.pushStatus} />
              <Button
                secondary
                title="Retry phone registration"
                disabled={school.offline}
                onPress={school.requestPushRegistration}
              />
              <Button
                secondary
                title="Open phone settings"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            </>
          )}
          {result.configuration && (
            <Text>
              {result.configuration.enabled
                ? "School delivery enabled."
                : "The school is setting up notifications."}{" "}
              {result.configuration.emailConfigured
                ? "Email service configured."
                : "School email delivery is being set up."}{" "}
              Registered phones: {result.configuration.registeredDevices}.
            </Text>
          )}
        </>
      )}
      <Text>
        Accepted means queued by the provider. Provider confirmed means handoff to Apple/Google or
        confirmed email delivery, not proof the phone displayed it. Read and acknowledged are
        tracked separately.
      </Text>
      {result.loading && (
        <Text accessibilityRole="progressbar">Loading notification history...</Text>
      )}
      {result.error && (
        <Feedback error message="Notification status is unavailable. Reload to try again." />
      )}
      {!result.loading && !result.records.length && (
        <Text>No notification deliveries recorded yet.</Text>
      )}
      {result.records.map((row) => (
        <Card key={row.id}>
          <Text weight="bold">
            {row.name} · {row.channel} ·{" "}
            {row.state === "Delivered" ? "Provider confirmed" : row.state}
          </Text>
          <Text>{row.kind === "Notice" ? "School update" : "Consent reminder"}</Text>
          {row.reason && <Text>{row.reason}</Text>}
          {row.canRetry && (
            <>
              <Button
                secondary
                title={confirm === row.id ? "Confirm retry" : "Retry delivery"}
                disabled={busy || school.offline}
                onPress={() => {
                  if (confirm !== row.id) {
                    setConfirm(row.id);
                    return;
                  }
                  setBusy(true);
                  setMessage("");
                  void result
                    .retry({ deliveryId: row.id })
                    .then(() => {
                      setMessage(
                        "Retry requested. Current access and preferences will be checked again.",
                      );
                      setConfirm("");
                    })
                    .catch(() =>
                      setMessage("Could not request retry. Check permissions and connection."),
                    )
                    .finally(() => setBusy(false));
                }}
              />
              {confirm === row.id && (
                <Text>A failed push may already have arrived. Confirm to send it again.</Text>
              )}
            </>
          )}
        </Card>
      ))}
      {(result.canLoadMore || result.loadingMore) && (
        <Button
          secondary
          title="Load more delivery records"
          disabled={result.loadingMore}
          onPress={result.loadMore}
        />
      )}
      {!!message && <Feedback message={message} />}
    </Card>
  );
}
