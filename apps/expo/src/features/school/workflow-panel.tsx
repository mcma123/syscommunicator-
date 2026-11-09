import { useState } from "react";
import { View, Switch } from "react-native";
import type { ReadModule } from "@school-connect/core/live";
import type { WorkflowForm, WorkflowFile } from "@school-connect/core/workflows";
import { workflowError } from "@school-connect/backend/react";
import { useWorkflows, useSchool } from "./store";
import { Card, Button, Chips, Field, Feedback, Text } from "./ui";
import { pickReport, openReport, openDownload } from "./report-files";
const supported = [
  "resources",
  "paymentHistory",
  "invitations",
  "messages",
  "calendar",
  "forms",
  "contact",
  "attendance",
  "conduct",
  "reports",
  "people",
  "settings",
  "profile",
  "children",
  "ads",
];
export function WorkflowPanel(props: {
  module: ReadModule;
  itemId?: string;
  learnerId?: string;
  /** Actions rendered elsewhere (e.g. the Ad Center composer handles adSave). */
  hide?: readonly string[];
}) {
  return supported.includes(props.module) ? (
    <Panel key={`${props.module}:${props.itemId ?? ""}:${props.learnerId ?? ""}`} {...props} />
  ) : null;
}
function Panel({
  module,
  itemId,
  learnerId,
  hide = [],
}: {
  module: ReadModule;
  itemId?: string;
  learnerId?: string;
  hide?: readonly string[];
}) {
  const [created, setCreated] = useState<string>();
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const result = useWorkflows(module, itemId ?? created, learnerId);
  if (result.status === "error")
    return (
      <Feedback
        error
        message="School actions are unavailable for this selection. Reload to try again."
      />
    );
  const forms = result.forms.filter((f) => !hide.includes(f.action));
  if (!forms.length) return null;
  const key = (f: WorkflowForm) => `${f.action}:${f.targetId ?? ""}`;
  const current = forms.find((f) => key(f) === selected) ?? forms[0];
  return (
    <Card>
      <Button
        secondary
        title={open ? "Close school actions" : "School actions"}
        onPress={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {forms.length > 1 && <Text weight="bold">Choose school action</Text>}
          <Chips
            items={forms.map((f) => f.title)}
            value={current.title}
            onChange={(title) => setSelected(key(forms.find((f) => f.title === title)!))}
          />
          <Editor
            key={`${key(current)}:${itemId ?? created ?? ""}`}
            form={current}
            itemId={itemId ?? created}
            submit={result.submit}
            onPending={() => setSuccess("")}
            onCreated={(id, message) => {
              setSuccess(message);
              if (
                !itemId &&
                module !== "children" &&
                [
                  "noticeSave",
                  "eventSave",
                  "consentCreate",
                  "enquiryCreate",
                  "attendanceSave",
                  "conductCreate",
                  "reportCreate",
                  "resourceCreate",
                  "adSave",
                ].includes(current.action)
              ) {
                setCreated(id);
                setSelected("");
              }
            }}
          />
          {success && <Feedback message={success} />}
          {created && !itemId && (
            <Button
              secondary
              title="Create another"
              onPress={() => {
                setCreated(undefined);
                setSelected("");
              }}
            />
          )}
        </>
      )}
    </Card>
  );
}
function Editor({
  form,
  itemId,
  submit,
  onCreated,
  onPending,
}: {
  form: WorkflowForm;
  itemId?: string;
  submit: ReturnType<typeof useWorkflows>["submit"];
  onCreated: (id: string, message: string) => void;
  onPending: () => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(form.fields.map((f) => [f.name, f.value])),
  );
  const [file, setFile] = useState<WorkflowFile>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { offline, emailReady } = useSchool();
  return (
    <View style={{ gap: 16 }}>
      <Text weight="bold">{form.title}</Text>
      <Text>{form.description}</Text>
      {form.fields.map((field) => (
        <View style={{ gap: 6 }} key={field.name}>
          {field.type === "toggle" ? (
            <>
              <Text>{field.label}</Text>
              <Switch
                accessibilityLabel={field.label}
                value={values[field.name] === "true"}
                onValueChange={(value) => setValues((v) => ({ ...v, [field.name]: String(value) }))}
              />
            </>
          ) : field.type === "select" ? (
            <>
              <Text>{field.label}</Text>
              <Chips
                items={field.options?.map((o) => o.label) ?? []}
                value={field.options?.find((o) => o.value === values[field.name])?.label ?? ""}
                onChange={(label) =>
                  setValues((v) => ({
                    ...v,
                    [field.name]: field.options?.find((o) => o.label === label)?.value ?? "",
                  }))
                }
              />
              {!field.options?.length && <Text>No available choices</Text>}
            </>
          ) : field.type === "file" ? (
            <>
              <Button
                secondary
                title={
                  form.action === "reportCreate"
                    ? "Choose PDF (maximum 10 MiB)"
                    : "Choose PDF, PNG or JPEG"
                }
                onPress={() => {
                  void pickReport(form.action === "reportCreate")
                    .then((f) => {
                      if (f && f.bytes.byteLength > (/\.pdf$/i.test(f.name) ? 10485760 : 5242880)) {
                        setFailed(true);
                        setMessage("PDFs may be up to 10 MiB; images up to 5 MiB.");
                        return;
                      }
                      setFile(f);
                    })
                    .catch(() => {
                      setFailed(true);
                      setMessage("Could not open this PDF. Check its size and try again.");
                    });
                }}
              />
              {file && <Text>{file.name}</Text>}
            </>
          ) : (
            <Field
              label={
                field.type === "datetime"
                  ? `${field.label} (YYYY-MM-DDTHH:mm)`
                  : field.type === "date"
                    ? `${field.label} (YYYY-MM-DD)`
                    : field.label
              }
              value={values[field.name] ?? ""}
              onChangeText={(value) => setValues((v) => ({ ...v, [field.name]: value }))}
              multiline={field.type === "multiline"}
              maxLength={field.type === "multiline" ? 10000 : 500}
            />
          )}
        </View>
      ))}
      {form.confirm && (
        <>
          <Text>Confirm {form.title.toLowerCase()}</Text>
          <Switch
            accessibilityLabel="Confirm action"
            value={confirmed}
            onValueChange={setConfirmed}
          />
        </>
      )}
      {form.action === "invite" && !emailReady && (
        <Feedback message="Invitation email is awaiting the school email-service setup." />
      )}
      <Button
        title={busy ? "Saving..." : form.title}
        disabled={
          offline ||
          busy ||
          (!!form.confirm && !confirmed) ||
          (form.fields.some((f) => f.type === "file") && !file) ||
          (form.action === "invite" && !emailReady)
        }
        onPress={() => {
          setBusy(true);
          setMessage("");
          void submit(
            {
              action: form.action,
              ...((form.targetId ?? itemId) ? { itemId: form.targetId ?? itemId } : {}),
              values,
            },
            file,
          )
            .then(async (out) => {
              if (out.download) await openDownload(out.download);
              if (out.file) await openReport(out.file);
              setFailed(false);
              onCreated(
                out.id,
                form.action === "invite"
                  ? "Invitation sent."
                  : out.download
                    ? "File downloaded."
                    : form.action === "reportDownload"
                      ? "Report ready to open."
                      : "Changes saved.",
              );
              setConfirmed(false);
            })
            .catch((error) => {
              setFailed(true);
              setMessage(workflowError(error));
            })
            .finally(() => setBusy(false));
        }}
      />
      {!!message && <Feedback error={failed} message={message} />}
    </View>
  );
}
