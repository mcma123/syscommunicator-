import { useState } from "react";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_KINDS,
  IMPORT_TEMPLATES,
  importTemplateCsv,
  parseImportCsv,
  type ClassRow,
  type GuardianRow,
  type ImportKind,
  type ImportParseResult,
  type LearnerRow,
  type StaffRow,
} from "@school-connect/core/imports";
import type { ImportRowResult } from "@school-connect/backend/client";
import type { Id } from "@school-connect/backend/dataModel";
import { useRosterImport } from "./store";

const MAX_FILE_BYTES = 1024 * 1024;
const LABELS: Record<ImportKind, string> = {
  classes: "Classes",
  learners: "Learners",
  guardians: "Parents / guardians",
  staff: "Staff",
};
const ORDER_HINT: Record<ImportKind, string> = {
  classes: "Import classes first; missing grades are created.",
  learners: "Classes must already exist. Learners match on school learner number.",
  guardians:
    "Learners must already exist. Guardians match on email plus learner number and are staged only.",
  staff: "Listed classes must already exist. Staff match on email and are staged only.",
};
type Row = ImportRowResult;

function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IMPORT_BATCH_SIZE)
    out.push(items.slice(i, i + IMPORT_BATCH_SIZE));
  return out;
}
/** Server rows carry raw cells keyed by template header; the server re-validates them. */
function cellsFor(kind: ImportKind, data: object): Record<string, string> {
  const d = data as Partial<ClassRow & LearnerRow & GuardianRow & StaffRow>;
  const text = (value: unknown) =>
    Array.isArray(value) ? value.join(";") : value === undefined ? "" : String(value);
  const map: Record<string, unknown> = {
    grade: d.grade,
    class_name: d.className,
    year: d.year,
    learner_number: d.learnerNumber,
    first_name: d.firstName,
    last_name: d.lastName,
    preferred_name: d.preferredName,
    date_of_birth: d.dateOfBirth,
    email: d.email,
    phone: d.phone,
    relationship: d.relationship,
    primary_contact:
      d.isPrimaryContact === undefined ? undefined : d.isPrimaryContact ? "yes" : "no",
    roles: d.roles,
    class_names: d.classNames,
  };
  return Object.fromEntries(IMPORT_TEMPLATES[kind].map((name) => [name, text(map[name])]));
}

export function RosterImport() {
  const { enabled, preview, commit, complete, batches } = useRosterImport();
  const [kind, setKind] = useState<ImportKind>("classes");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportParseResult<ImportKind> | null>(null);
  const [results, setResults] = useState<Row[] | null>(null);
  const [checked, setChecked] = useState<"preview" | "committed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!enabled) return <p>Only an Administrator can import school records.</p>;

  const reset = () => {
    setParsed(null);
    setResults(null);
    setChecked(null);
    setMessage("");
  };
  const serverRows = () =>
    (parsed?.rows ?? []).map((r) => ({ row: r.row, cells: cellsFor(kind, r.data) }));
  const clientErrors: Row[] = (parsed?.errors ?? []).map((e) => ({
    row: e.row,
    outcome: "rejected",
    messages: [e.field ? `${e.field}: ${e.message}` : e.message],
  }));
  const shown = [...clientErrors, ...(results ?? [])].sort((a, b) => a.row - b.row);
  const count = (outcome: Row["outcome"]) => shown.filter((r) => r.outcome === outcome).length;
  const changes = (results ?? []).filter(
    (r) => r.outcome === "create" || r.outcome === "update",
  ).length;

  const runPreview = async () => {
    setBusy(true);
    setMessage("");
    try {
      const all: Row[] = [];
      for (const rows of chunks(serverRows())) all.push(...(await preview({ kind, rows })));
      setResults(all);
      setChecked("preview");
    } catch {
      setMessage("Could not check the file against school records. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const runCommit = async () => {
    const rows = serverRows();
    if (!window.confirm(`Import ${rows.length} checked rows of ${LABELS[kind].toLowerCase()}?`))
      return;
    setBusy(true);
    setMessage("");
    const all: Row[] = [];
    let batchId: Id<"importBatches"> | undefined;
    try {
      for (const part of chunks(rows)) {
        const result = await commit({
          kind,
          fileName,
          totalRows: rows.length,
          ...(batchId ? { batchId } : {}),
          rows: part,
        });
        batchId = result.batchId;
        all.push(...result.results);
      }
      if (batchId) await complete({ batchId });
      setMessage("Import complete.");
    } catch {
      setMessage(
        `Import stopped after ${all.length} of ${rows.length} rows. Rows already saved are kept; importing the same file again skips unchanged rows.`,
      );
    } finally {
      setResults(all);
      setChecked("committed");
      setBusy(false);
    }
  };

  return (
    <section className="record-card">
      <h2>Import school records</h2>
      <p>
        Upload a CSV based on the template. Every row is checked before anything is saved, and the
        server checks each row again when importing. Parents and staff are staged only: importing
        never creates accounts, grants sign-in or sends invitations.
      </p>
      <label>
        Record type
        <select
          className="field"
          value={kind}
          disabled={busy}
          onChange={(e) => {
            setKind(e.target.value as ImportKind);
            setFileName("");
            reset();
          }}
        >
          {IMPORT_KINDS.map((k) => (
            <option key={k} value={k}>
              {LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <p>{ORDER_HINT[kind]}</p>
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(importTemplateCsv(kind))}`}
        download={`${kind}-template.csv`}
      >
        Download {LABELS[kind].toLowerCase()} template
      </a>
      <label>
        CSV file
        <input
          className="field"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            reset();
            const file = e.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            if (file.size > MAX_FILE_BYTES) {
              setMessage("Choose a CSV file of at most 1 MB.");
              return;
            }
            setParsed(parseImportCsv(kind, await file.text()));
          }}
        />
      </label>
      {parsed && (
        <p role="status">
          {parsed.totalRows} rows read: {parsed.rows.length} valid, {parsed.errors.length} problems
          found in the file.
        </p>
      )}
      {parsed && parsed.rows.length > 0 && checked === null && (
        <button className="demo-login-submit" disabled={busy} onClick={() => void runPreview()}>
          Check against school records
        </button>
      )}
      {checked === "preview" && (
        <>
          <p>
            Ready: {count("create")} new, {count("update")} updates, {count("unchanged")} unchanged,{" "}
            {count("rejected")} rejected.
          </p>
          <button
            className="demo-login-submit"
            disabled={busy || changes === 0}
            onClick={() => void runCommit()}
          >
            Import {changes} changes
          </button>
        </>
      )}
      {checked === "committed" && (
        <p>
          Saved: {count("create")} new, {count("update")} updated, {count("unchanged")} unchanged,{" "}
          {count("rejected")} rejected.
        </p>
      )}
      <p role="status">{message}</p>
      {shown.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Row</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={`${r.row}:${i}`}>
                <td>{r.row}</td>
                <td>{r.outcome}</td>
                <td>{r.messages.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Recent imports</h3>
      {batches === undefined ? (
        <p role="status">Loading imports...</p>
      ) : batches.length === 0 ? (
        <p>No imports yet.</p>
      ) : (
        <ul>
          {batches.map((b) => (
            <li key={b._id}>
              {LABELS[b.kind]} · {b.fileName} · {b.status}: {b.created} new, {b.updated} updated,{" "}
              {b.unchanged} unchanged, {b.rejected} rejected
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
