import { useState } from "react";
import type { ReadModule } from "@school-connect/core/live";
import type { WorkflowForm, WorkflowFile } from "@school-connect/core/workflows";
import { workflowError } from "@school-connect/backend/react";
import { useWorkflows, useSchool } from "./store";
import { Button } from "@/components/ui/button";
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
/** Client-side size check mirroring the server limits (server re-validates everything). */
function sizeProblem(file: File) {
  return file.size > (/\.pdf$/i.test(file.name) ? 10485760 : 5242880)
    ? "PDFs may be up to 10 MiB; images up to 5 MiB."
    : "";
}
export function WorkflowPanel(props: {
  module: ReadModule;
  itemId?: string | undefined;
  learnerId?: string | undefined;
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
  itemId?: string | undefined;
  learnerId?: string | undefined;
  hide?: readonly string[];
}) {
  const [created, setCreated] = useState<string>();
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const result = useWorkflows(module, itemId ?? created, learnerId);
  if (result.status === "error")
    return (
      <p role="alert">School actions are unavailable for this selection. Reload to try again.</p>
    );
  const forms = result.forms.filter((f) => !hide.includes(f.action));
  if (!forms.length) return null;
  const key = (f: WorkflowForm) => `${f.action}:${f.targetId ?? ""}`;
  const current = forms.find((f) => key(f) === selected) ?? forms[0]!;
  return (
    <section className="record-card my-4">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? "Close school actions" : "School actions"}
      </Button>
      {open && (
        <>
          <label className="block my-3">
            Action
            <select
              aria-label="School action"
              className="field w-full"
              value={key(current)}
              onChange={(e) => setSelected(e.target.value)}
            >
              {forms.map((f) => (
                <option key={key(f)} value={key(f)}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
          <Editor
            key={`${key(current)}:${itemId ?? created ?? ""}`}
            form={current}
            submit={result.submit}
            itemId={itemId ?? created}
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
                ].includes(current.action)
              ) {
                setCreated(id);
                setSelected("");
              }
            }}
          />
          {success && <p role="status">{success}</p>}
          {created && !itemId && (
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(undefined);
                setSelected("");
              }}
            >
              Create another
            </Button>
          )}
        </>
      )}
    </section>
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
  itemId: string | undefined;
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
  const [failure, setFailure] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { offline, emailReady } = useSchool();
  return (
    <form
      className="grid gap-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (offline || busy) return;
        onPending();
        setBusy(true);
        setMessage("");
        try {
          const out = await submit(
            {
              action: form.action,
              ...((form.targetId ?? itemId) ? { itemId: form.targetId ?? itemId } : {}),
              values,
            },
            file,
          );
          if (out.download) {
            const response = await fetch(out.download.url, { cache: "no-store" });
            if (!response.ok) throw new Error("Download expired. Try opening the file again.");
            const url = URL.createObjectURL(await response.blob());
            const a = document.createElement("a");
            a.href = url;
            a.download = out.download.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          if (out.file) {
            const url = URL.createObjectURL(
              new Blob([out.file.bytes], { type: "application/pdf" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = out.file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          setFailure(false);
          onCreated(
            out.id,
            form.action === "invite"
              ? "Invitation sent."
              : out.download
                ? "File downloaded."
                : form.action === "reportDownload"
                  ? "Report downloaded."
                  : "Changes saved.",
          );
          setConfirmed(false);
        } catch (error) {
          setFailure(true);
          setMessage(workflowError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{form.title}</h3>
      <p className="text-sm text-muted-foreground">{form.description}</p>
      {form.fields.map((field) => (
        <label key={field.name} className="grid gap-1 text-sm">
          {field.label}
          {field.type === "select" ? (
            <select
              className="field"
              aria-label={field.label}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            >
              {!field.options?.length && <option value="">No available choices</option>}
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : field.type === "toggle" ? (
            <input
              type="checkbox"
              aria-label={field.label}
              checked={values[field.name] === "true"}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: String(e.target.checked) }))}
            />
          ) : field.type === "file" ? (
            <input
              type="file"
              accept={
                form.action === "reportCreate"
                  ? "application/pdf,.pdf"
                  : "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
              }
              aria-label={field.label}
              required
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  const problem = sizeProblem(selected);
                  if (problem) {
                    setFailure(true);
                    setMessage(problem);
                    setFile(undefined);
                    return;
                  }
                  void selected
                    .arrayBuffer()
                    .then((bytes) => setFile({ name: selected.name, bytes }));
                }
              }}
            />
          ) : field.type === "multiline" ? (
            <textarea
              aria-label={field.label}
              className="field min-h-24"
              required={field.required}
              maxLength={10000}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          ) : (
            <input
              aria-label={field.label}
              className="field"
              type={
                field.type === "datetime"
                  ? "datetime-local"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              required={field.required}
              value={values[field.name] ?? ""}
              maxLength={500}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      {form.confirm && (
        <label className="text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Confirm {form.title.toLowerCase()}
        </label>
      )}
      {form.action === "invite" && !emailReady && (
        <p role="status">Invitation email is awaiting the school email-service setup.</p>
      )}
      <Button
        type="submit"
        disabled={
          offline ||
          busy ||
          (!!form.confirm && !confirmed) ||
          (form.fields.some((f) => f.type === "file") && !file) ||
          (form.action === "invite" && !emailReady)
        }
      >
        {busy ? "Saving..." : form.title}
      </Button>
      {message && <p role={failure ? "alert" : "status"}>{message}</p>}
    </form>
  );
}
