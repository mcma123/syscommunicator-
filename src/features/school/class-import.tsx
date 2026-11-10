import { useState, type DragEvent } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import {
  CLASS_IMPORT_TEMPLATE,
  IMPORT_BATCH_SIZE,
  classImportTemplateCsv,
  parseClassImportCsv,
  type ClassImportResult,
  type ClassImportRow,
} from "@school-connect/core/imports";
import type { ClassFolder } from "@school-connect/core/live";
import type { ImportRowResult } from "@school-connect/backend/client";
import type { Id } from "@school-connect/backend/dataModel";
import { Button } from "@/components/ui/button";
import { useClassImport } from "./store";

const MAX_FILE_BYTES = 1024 * 1024;
type Outcome = ImportRowResult["outcome"];
type Line = { row: number; who: string; outcome: Outcome; messages: string[] };

const OUTCOME_LABEL: Record<Outcome, string> = {
  create: "New",
  update: "Update",
  unchanged: "No change",
  rejected: "Not imported",
};

function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IMPORT_BATCH_SIZE)
    out.push(items.slice(i, i + IMPORT_BATCH_SIZE));
  return out;
}

/**
 * Teacher/Principal CSV import into one class folder: learners plus an optional
 * parent contact per row. The class, grade and year come from the open folder;
 * the server re-checks every row and only accepts classes the teacher teaches.
 */
export function ClassImport({ folder }: { folder: ClassFolder }) {
  const { enabled, preview, commit, complete } = useClassImport();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ClassImportResult | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [stage, setStage] = useState<"checked" | "saved" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  if (!enabled || folder.year === null) return null;
  const target = { grade: folder.grade, className: folder.name, year: folder.year };

  const reset = () => {
    setParsed(null);
    setLines(null);
    setStage(null);
    setMessage("");
  };
  const readFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setMessage(
        "Choose a .csv file. In Excel or Google Sheets use File → Save as / Download → CSV.",
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Choose a CSV file of at most 1 MB.");
      return;
    }
    setParsed(parseClassImportCsv(await file.text(), target));
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) void readFile(e.dataTransfer.files[0]);
  };

  const rows = parsed?.rows ?? [];
  const byRow = new Map(rows.map((r) => [r.row, r]));
  const who = (r: ClassImportRow | undefined, row: number) =>
    r ? `${r.name} (${r.learnerNumber})` : `Row ${row}`;
  const fileProblems: Line[] = (parsed?.errors ?? []).map((e) => ({
    row: e.row,
    who: e.row === 1 ? "File" : `Row ${e.row}`,
    outcome: "rejected",
    messages: [e.field ? `${e.field}: ${e.message}` : e.message],
  }));
  const shown = [...fileProblems, ...(lines ?? [])].sort((a, b) => a.row - b.row);
  const count = (o: Outcome) => (lines ?? []).filter((l) => l.outcome === o).length;
  const parents = rows.filter((r) => r.guardian).length;
  const changes = count("create") + count("update");

  const toLines = (results: ImportRowResult[]) =>
    results.map((r) => ({ ...r, who: who(byRow.get(r.row), r.row) }));

  const check = async () => {
    setBusy(true);
    setMessage("");
    try {
      const all: ImportRowResult[] = [];
      for (const part of chunks(rows.map((r) => ({ row: r.row, cells: r.learner }))))
        all.push(...(await preview({ kind: "learners", rows: part })));
      setLines(toLines(all));
      setStage("checked");
    } catch {
      setMessage("Could not check the file against school records. Try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Commits one kind as its own audited batch and closes it. */
  const save = async (
    kind: "learners" | "guardians",
    items: { row: number; cells: Record<string, string> }[],
  ) => {
    const results: ImportRowResult[] = [];
    let batchId: Id<"importBatches"> | undefined;
    for (const part of chunks(items)) {
      const result = await commit({
        kind,
        fileName,
        totalRows: items.length,
        ...(batchId ? { batchId } : {}),
        rows: part,
      });
      batchId = result.batchId;
      results.push(...result.results);
    }
    if (batchId) await complete({ batchId });
    return results;
  };

  const runImport = async () => {
    if (!window.confirm(`Import ${rows.length} learners into ${folder.label}?`)) return;
    setBusy(true);
    setMessage("");
    let learnerResults: ImportRowResult[] = [];
    try {
      learnerResults = await save(
        "learners",
        rows.map((r) => ({ row: r.row, cells: r.learner })),
      );
      const saved = new Set(
        learnerResults.filter((r) => r.outcome !== "rejected").map((r) => r.row),
      );
      const guardianRows = rows
        .filter((r) => r.guardian && saved.has(r.row))
        .map((r) => ({ row: r.row, cells: r.guardian! }));
      const guardianResults = guardianRows.length > 0 ? await save("guardians", guardianRows) : [];
      const parentNote = new Map(
        guardianResults.map((g) => [
          g.row,
          g.outcome === "rejected"
            ? `Parent not saved: ${g.messages.join(" ")}`
            : g.outcome === "unchanged"
              ? "Parent contact already on file."
              : "Parent contact saved for the office to invite.",
        ]),
      );
      setLines(
        toLines(learnerResults).map((l) => ({
          ...l,
          messages: [...l.messages, ...(parentNote.has(l.row) ? [parentNote.get(l.row)!] : [])],
        })),
      );
      setMessage("Import complete. The learners now appear in this class.");
    } catch {
      setLines(toLines(learnerResults));
      setMessage(
        "The import stopped part-way. Learners already saved are kept; importing the same file again skips them.",
      );
    } finally {
      setStage("saved");
      setBusy(false);
    }
  };

  if (!open)
    return (
      <div className="class-import-bar">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Upload /> Import learners (CSV)
        </Button>
      </div>
    );

  return (
    <section className="class-import" aria-label={`Import learners into ${folder.label}`}>
      <header>
        <div>
          <h3>Import learners into {folder.label}</h3>
          <p>
            One row per learner. Fill in the class list in Excel or Google Sheets, save it as CSV
            and drop it here. Nothing is saved until you confirm.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close import"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setFileName("");
            reset();
          }}
        >
          <X />
        </Button>
      </header>
      <ol className="class-import-steps">
        <li>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(classImportTemplateCsv())}`}
            download={`${folder.label.replace(/[^\w-]+/g, "-")}-learners.csv`}
          >
            <Download size={14} /> Download the class template
          </a>
          <small>
            Required: learner_number (school admission number), first_name, last_name. Optional:
            preferred_name, date_of_birth (YYYY-MM-DD) and one parent per learner (parent_email,
            parent_first_name, parent_last_name, parent_phone, parent_relationship such as Mother,
            Father or Guardian).
          </small>
        </li>
        <li>
          <label
            className={`class-import-drop${dragging ? " is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <FileSpreadsheet size={26} />
            <strong>{fileName || "Drop the CSV file here, or click to choose"}</strong>
            <span>CSV · up to 1 MB · {CLASS_IMPORT_TEMPLATE.length} template columns</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </li>
      </ol>
      {parsed && (
        <p role="status" className="class-import-summary">
          {parsed.totalRows} rows read: {rows.length} learners ready
          {parents > 0 ? ` (${parents} with a parent contact)` : ""}
          {parsed.errors.length > 0 ? `, ${parsed.errors.length} problems to fix` : ""}.
        </p>
      )}
      {rows.length > 0 && stage === null && (
        <Button disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check against school records"}
        </Button>
      )}
      {stage === "checked" && (
        <div className="class-import-actions">
          <p>
            {count("create")} new, {count("update")} updated, {count("unchanged")} already up to
            date, {count("rejected")} cannot be imported.
          </p>
          <Button disabled={busy || changes + parents === 0} onClick={() => void runImport()}>
            {busy ? "Importing…" : `Import ${rows.length - count("rejected")} learners`}
          </Button>
        </div>
      )}
      {stage === "saved" && (
        <p className="class-import-summary">
          Saved: {count("create")} new, {count("update")} updated, {count("unchanged")} unchanged,{" "}
          {count("rejected")} not imported.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {shown.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Learner</th>
                <th>Result</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l, i) => (
                <tr key={`${l.row}:${i}`} data-outcome={l.outcome}>
                  <td>{l.row}</td>
                  <td>{l.who}</td>
                  <td>{OUTCOME_LABEL[l.outcome]}</td>
                  <td>{l.messages.join(" ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="class-import-note">
        Parent contacts are only stored for the school office: importing never creates parent
        accounts or sends invitations.
      </p>
    </section>
  );
}
