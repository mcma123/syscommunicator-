import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Image } from "expo-image";
import { workflowError } from "@school-connect/backend/react";
import type { WorkflowForm } from "@school-connect/core/workflows";
import { colors } from "@/theme/school";
import { Badge, Button, Card, Chips, Feedback, Field, Icon, Text } from "./ui";
import { adContentType, useAdMedia, useAdUploader, useSchool, useWorkflows } from "./store";
import { pickAdFiles, type PickedAdFile } from "./report-files";

const MB = 1024 * 1024;
const MAX_ITEMS = 10;
type Queued = PickedAdFile & {
  id: string;
  type: string;
  kind: "image" | "video";
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string | undefined;
};
const localInput = (at: number) => new Date(at + 7200000).toISOString().slice(0, 16);

/** Server-provided values plus defaults for a new ad (starts now, runs two weeks). */
function formDefaults(form: WorkflowForm, openedAt: number) {
  const initial: Record<string, string> = Object.fromEntries(
    form.fields.map((f) => [f.name, f.value]),
  );
  initial["startsAt"] ||= localInput(openedAt);
  initial["endsAt"] ||= localInput(openedAt + 14 * 86400000);
  initial["audience"] ||= form.fields.find((f) => f.name === "audience")?.options?.[0]?.value ?? "";
  initial["popup"] ||= "false";
  return initial;
}

/** One-step native ad editor: text, schedule, audience and pictures/videos (to Cloudflare R2). */
export function AdComposer({
  adId,
  onSaved,
}: {
  adId?: string | undefined;
  onSaved?: (id: string) => void;
}) {
  const { offline } = useSchool();
  const workflows = useWorkflows("ads", adId);
  const form = workflows.forms.find((f) => f.action === "adSave");
  const media = useAdMedia(adId);
  const uploader = useAdUploader();
  // Fixed when the editor opens, so new ads default to going live straight away.
  const [openedAt] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const values = useMemo(
    () => ({ ...(form ? formDefaults(form, openedAt) : {}), ...edits }),
    [form, openedAt, edits],
  );
  const ready = !!form;
  const [linkChoice, setWithLink] = useState<boolean | null>(null);
  const withLink = linkChoice ?? !!(form && formDefaults(form, openedAt)["linkUrl"]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  if (!form) return null;
  const audience = form.fields.find((f) => f.name === "audience")?.options ?? [];
  const pending = queue.filter((q) => q.status !== "done");
  const set = (name: string, value: string) => setEdits((v) => ({ ...v, [name]: value }));
  const patch = (id: string, change: Partial<Queued>) =>
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const choose = async () => {
    try {
      const picked = await pickAdFiles();
      const issues: string[] = [];
      const next: Queued[] = [];
      let room = MAX_ITEMS - media.items.length - pending.length;
      for (const f of picked) {
        const type = adContentType(f.name);
        const kind = type.startsWith("video/") ? "video" : "image";
        if (!type)
          issues.push(`${f.name}: use a PNG, JPEG or WebP picture, or an MP4, WebM or MOV video.`);
        else if (f.size > (kind === "video" ? 50 * MB : 10 * MB))
          issues.push(
            `${f.name}: ${kind === "video" ? "videos" : "pictures"} may be up to ${kind === "video" ? 50 : 10} MB.`,
          );
        else if (room-- <= 0) issues.push(`${f.name}: an ad can have up to ${MAX_ITEMS} items.`);
        else
          next.push({
            ...f,
            id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
            type,
            kind,
            status: "queued",
            progress: 0,
          });
      }
      setProblems(issues);
      setQueue((q) => [...q, ...next]);
    } catch {
      setProblems(["Could not open your files. Please try again."]);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const out = await workflows.submit({
        action: "adSave",
        itemId: adId,
        values: {
          ...values,
          linkUrl: withLink ? (values["linkUrl"] ?? "") : "",
          linkLabel: withLink ? (values["linkLabel"] ?? "") : "",
        },
      });
      const id = adId ?? out.id;
      let errors = 0;
      for (const item of queue.filter((q) => q.status === "queued" || q.status === "error")) {
        patch(item.id, { status: "uploading", error: undefined });
        try {
          const body = await item.read();
          await uploader.upload(id, { name: item.name, type: item.type, size: item.size, body });
          patch(item.id, { status: "done" });
        } catch (e) {
          errors++;
          patch(item.id, { status: "error", error: workflowError(e) });
        }
      }
      setFailed(errors > 0);
      setMessage(
        errors
          ? `Ad saved, but ${errors} file${errors === 1 ? "" : "s"} could not upload.`
          : adId
            ? "Changes saved."
            : "Ad saved as a draft. Open it to submit or publish.",
      );
      if (!errors) {
        setQueue([]);
        onSaved?.(id);
      }
    } catch (e) {
      setFailed(true);
      setMessage(workflowError(e));
    } finally {
      setBusy(false);
    }
  };
  const run = (action: Promise<unknown>) =>
    void action.catch((e) => {
      setFailed(true);
      setMessage(workflowError(e));
    });

  return (
    <Card>
      <Text weight="bold" style={{ fontSize: 18 }}>
        {adId ? "Edit ad" : "Create an ad"}
      </Text>
      <Text style={{ color: colors.muted }}>{form.description}</Text>
      <Field
        label="Headline"
        value={values["title"] ?? ""}
        maxLength={80}
        onChangeText={(v) => set("title", v)}
      />
      <Field
        label="Caption"
        value={values["caption"] ?? ""}
        maxLength={500}
        multiline
        onChangeText={(v) => set("caption", v)}
      />
      <Field
        label="Show from (YYYY-MM-DDTHH:mm)"
        value={values["startsAt"] ?? ""}
        onChangeText={(v) => set("startsAt", v)}
      />
      <Field
        label="Show until (YYYY-MM-DDTHH:mm)"
        value={values["endsAt"] ?? ""}
        onChangeText={(v) => set("endsAt", v)}
      />
      <Text weight="bold">Who sees it</Text>
      <Chips
        items={audience.map((o) => o.label)}
        value={audience.find((o) => o.value === values["audience"])?.label ?? ""}
        onChange={(label) => set("audience", audience.find((o) => o.label === label)?.value ?? "")}
      />
      <View style={styles.switchRow}>
        <Text style={{ flex: 1 }}>Also show as a popup (once per device)</Text>
        <Switch
          accessibilityLabel="Also show as a popup"
          value={values["popup"] === "true"}
          onValueChange={(on) => set("popup", String(on))}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={{ flex: 1 }}>Add a button link</Text>
        <Switch
          accessibilityLabel="Add a button link"
          value={withLink}
          onValueChange={setWithLink}
        />
      </View>
      {withLink && (
        <>
          <Field
            label="Link (https://)"
            value={values["linkUrl"] ?? ""}
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={(v) => set("linkUrl", v)}
          />
          <Field
            label="Button text"
            value={values["linkLabel"] ?? ""}
            maxLength={40}
            onChangeText={(v) => set("linkLabel", v)}
          />
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add pictures or videos"
        onPress={() => void choose()}
        style={styles.picker}
      >
        <Icon name="cloud-upload-outline" size={28} />
        <Text weight="bold">Add pictures or videos</Text>
        <Text style={styles.hint}>
          Up to {MAX_ITEMS} items · pictures 10 MB · videos 50 MB (MP4, WebM, MOV)
        </Text>
      </Pressable>
      {problems.map((p) => (
        <Feedback key={p} error message={p} />
      ))}

      {media.items.map((m, i) => (
        <View key={m.id} style={styles.tile}>
          {m.kind === "image" ? (
            <Image source={{ uri: m.url }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.videoThumb]}>
              <Icon name="videocam" color="white" />
            </View>
          )}
          <Text numberOfLines={1} style={{ flex: 1 }}>
            {i + 1}. {m.fileName}
          </Text>
          <Pressable
            accessibilityLabel={`Move ${m.fileName} earlier`}
            disabled={i === 0}
            onPress={() => run(uploader.move(m.id, -1))}
          >
            <Icon name="arrow-up" size={18} color={i === 0 ? colors.border : colors.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Remove ${m.fileName}`}
            onPress={() => run(uploader.remove(m.id))}
          >
            <Icon name="trash-outline" size={18} />
          </Pressable>
        </View>
      ))}
      {queue.map((q) => (
        <View key={q.id} style={styles.tile}>
          {q.kind === "image" ? (
            <Image source={{ uri: q.uri }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.videoThumb]}>
              <Icon name="videocam" color="white" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1}>{q.name}</Text>
            <Text style={styles.hint}>
              {(q.size / MB).toFixed(1)} MB ·{" "}
              {q.status === "uploading"
                ? "Uploading…"
                : q.status === "done"
                  ? "Uploaded"
                  : q.status === "error"
                    ? q.error
                    : "Ready to upload"}
            </Text>
          </View>
          {q.status === "done" ? (
            <Badge label="Done" good />
          ) : q.status !== "uploading" ? (
            <Pressable
              accessibilityLabel={`Remove ${q.name}`}
              onPress={() => setQueue((list) => list.filter((x) => x.id !== q.id))}
            >
              <Icon name="close-circle-outline" size={20} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {message ? <Feedback error={failed} message={message} /> : null}
      <Button
        title={
          busy
            ? "Saving…"
            : pending.length
              ? `Save and upload ${pending.length} file${pending.length === 1 ? "" : "s"}`
              : adId
                ? "Save changes"
                : "Save draft"
        }
        disabled={busy || offline || !ready}
        onPress={() => void save()}
      />
    </Card>
  );
}

/** Ad Center screen header: opens the composer for a new ad. */
export function AdComposerLauncher() {
  const [open, setOpen] = useState(false);
  return open ? (
    <>
      <AdComposer onSaved={() => setOpen(false)} />
      <Button secondary title="Close editor" onPress={() => setOpen(false)} />
    </>
  ) : (
    <Button title="New ad" icon="add" onPress={() => setOpen(true)} />
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  picker: {
    alignItems: "center",
    gap: 6,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hint: { fontSize: 12, color: colors.muted, textAlign: "center" },
  tile: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 64, height: 40, borderRadius: 8, backgroundColor: "#1a1012" },
  videoThumb: { alignItems: "center", justifyContent: "center" },
});
