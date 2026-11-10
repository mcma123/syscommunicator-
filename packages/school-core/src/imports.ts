// Phase 11 roster import contracts: CSV templates, parsing and row validation.
// Pure and provider-independent: the web client uses it for preview and the
// backend re-validates every committed row with the same functions.
import {
  GUARDIAN_RELATIONSHIPS,
  STAFF_ROLES,
  type GuardianRelationship,
  type StaffRole,
} from "./domain";

export const IMPORT_KINDS = ["classes", "learners", "guardians", "staff"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/** Header row of each downloadable CSV template, in column order. */
export const IMPORT_TEMPLATES: Record<ImportKind, readonly string[]> = {
  classes: ["grade", "class_name", "year"],
  learners: [
    "learner_number",
    "first_name",
    "last_name",
    "preferred_name",
    "date_of_birth",
    "grade",
    "class_name",
    "year",
  ],
  guardians: [
    "learner_number",
    "email",
    "first_name",
    "last_name",
    "phone",
    "relationship",
    "primary_contact",
  ],
  staff: ["email", "first_name", "last_name", "phone", "roles", "class_names", "year"],
};
const REQUIRED: Record<ImportKind, readonly string[]> = {
  classes: ["grade", "class_name", "year"],
  learners: ["learner_number", "first_name", "last_name", "grade", "class_name", "year"],
  guardians: ["learner_number", "email", "first_name", "last_name", "relationship"],
  staff: ["email", "first_name", "last_name", "roles"],
};

export const IMPORT_MAX_ROWS = 2000;
/** Rows per committed server batch; keeps each mutation well inside transaction limits. */
export const IMPORT_BATCH_SIZE = 50;

export interface ClassRow {
  grade: string;
  className: string;
  year: number;
}
export interface LearnerRow {
  learnerNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | undefined;
  dateOfBirth?: string | undefined;
  grade: string;
  className: string;
  year: number;
}
export interface GuardianRow {
  learnerNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  relationship: GuardianRelationship;
  /** Undefined when the cell is blank: never overwrites a stored value. */
  isPrimaryContact?: boolean | undefined;
}
export interface StaffRow {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  roles: StaffRole[];
  /** Undefined when the cell is blank: never overwrites stored classes. */
  classNames?: string[] | undefined;
  year?: number | undefined;
}
export type ImportRowFor<K extends ImportKind> = K extends "classes"
  ? ClassRow
  : K extends "learners"
    ? LearnerRow
    : K extends "guardians"
      ? GuardianRow
      : StaffRow;

/** `row` is the 1-based spreadsheet line (header is line 1). */
export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}
export interface ImportValidRow<K extends ImportKind> {
  row: number;
  key: string;
  data: ImportRowFor<K>;
}
export interface ImportParseResult<K extends ImportKind> {
  kind: K;
  rows: ImportValidRow<K>[];
  errors: ImportRowError[];
  totalRows: number;
}

export function importTemplateCsv(kind: ImportKind): string {
  return `${IMPORT_TEMPLATES[kind].join(",")}\r\n`;
}

/** RFC 4180 parser: quoted fields, escaped quotes, embedded newlines, CRLF/LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  return parseCsvRecords(text).map((r) => r.cells);
}

/**
 * Like parseCsv, but keeps each record's 1-based spreadsheet row number. Blank
 * rows are skipped without renumbering later rows; a quoted multi-line cell
 * stays one row.
 */
export function parseCsvRecords(text: string): { row: number; cells: string[] }[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("The file has an unclosed quoted field.");
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records
    .map((cells, index) => ({ row: index + 1, cells }))
    .filter((r) => r.cells.some((cell) => cell.trim() !== ""));
}

const FORMULA_FIELDS = new Set([
  "grade",
  "class_name",
  "learner_number",
  "first_name",
  "last_name",
  "preferred_name",
  "roles",
  "class_names",
]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const optional = (value: string) => (value === "" ? undefined : value);
/** School learner numbers compare case-insensitively; store them upper-case. */
export const normalizeLearnerNumber = (value: string) => clean(value).toUpperCase();

export function normalizeImportEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}
/** Normalizes a South African or international phone number to digits with optional leading +. */
export function normalizeImportPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  if (!/^\+?\d{9,15}$/.test(compact)) return null;
  return compact;
}
function parseYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}
function parseDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? value
    : null;
}
function parseBoolean(value: string): boolean | undefined | null {
  const v = value.toLowerCase();
  if (v === "") return undefined;
  if (["no", "n", "false", "0"].includes(v)) return false;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  return null;
}
function matchEnum<T extends string>(values: readonly T[], value: string): T | null {
  return values.find((option) => option.toLowerCase() === value.toLowerCase()) ?? null;
}
function bounded(errors: ImportRowError[], row: number, field: string, value: string, max: number) {
  if (value.length > max) errors.push({ row, field, message: `Use at most ${max} characters.` });
}

/** Natural key used for duplicate detection within a file and against the database. */
export function importRowKey<K extends ImportKind>(kind: K, data: ImportRowFor<K>): string {
  switch (kind) {
    case "classes": {
      const c = data as ClassRow;
      return `${c.year}|${c.className}`;
    }
    case "learners":
      return (data as LearnerRow).learnerNumber;
    case "guardians": {
      const g = data as GuardianRow;
      return `${g.email}|${g.learnerNumber}`;
    }
    default:
      return (data as StaffRow).email;
  }
}

/** Validates one row's cells (keyed by template header). Returns data or field errors. */
export function validateImportRow<K extends ImportKind>(
  kind: K,
  cells: Record<string, string>,
  row: number,
): { data?: ImportRowFor<K>; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const get = (name: string) => clean(cells[name]);
  for (const name of REQUIRED[kind])
    if (get(name) === "") errors.push({ row, field: name, message: "This value is required." });
  for (const name of IMPORT_TEMPLATES[kind]) {
    bounded(errors, row, name, get(name), 120);
    // Spreadsheet formula prefixes are refused in free text so later exports cannot execute them.
    if (FORMULA_FIELDS.has(name) && /^[=+\-@]/.test(get(name)))
      errors.push({ row, field: name, message: "Remove the leading =, +, - or @." });
  }
  const year = (name = "year") => {
    const raw = get(name);
    if (raw === "") return undefined;
    const parsed = parseYear(raw);
    if (parsed === null) errors.push({ row, field: name, message: "Use a four-digit year." });
    return parsed ?? undefined;
  };
  const email = (name: string) => {
    const raw = get(name);
    if (raw === "") return undefined;
    const parsed = normalizeImportEmail(raw);
    if (!parsed) errors.push({ row, field: name, message: "Enter a valid email address." });
    return parsed ?? undefined;
  };
  const phone = () => {
    const raw = get("phone");
    if (raw === "") return undefined;
    const parsed = normalizeImportPhone(raw);
    if (!parsed) errors.push({ row, field: "phone", message: "Enter a valid phone number." });
    return parsed ?? undefined;
  };
  let data: unknown;
  switch (kind) {
    case "classes":
      data = {
        grade: get("grade"),
        className: get("class_name"),
        year: year(),
      };
      break;
    case "learners": {
      const dob = get("date_of_birth");
      const dateOfBirth = dob === "" ? undefined : parseDate(dob);
      if (dateOfBirth === null)
        errors.push({ row, field: "date_of_birth", message: "Use the YYYY-MM-DD date format." });
      data = {
        learnerNumber: normalizeLearnerNumber(get("learner_number")),
        firstName: get("first_name"),
        lastName: get("last_name"),
        preferredName: optional(get("preferred_name")),
        dateOfBirth: dateOfBirth ?? undefined,
        grade: get("grade"),
        className: get("class_name"),
        year: year(),
      };
      break;
    }
    case "guardians": {
      const relationship = matchEnum(GUARDIAN_RELATIONSHIPS, get("relationship"));
      if (get("relationship") !== "" && !relationship)
        errors.push({
          row,
          field: "relationship",
          message: `Use one of: ${GUARDIAN_RELATIONSHIPS.join(", ")}.`,
        });
      const primary = parseBoolean(get("primary_contact"));
      if (primary === null)
        errors.push({ row, field: "primary_contact", message: "Use yes or no." });
      data = {
        learnerNumber: normalizeLearnerNumber(get("learner_number")),
        email: email("email"),
        firstName: get("first_name"),
        lastName: get("last_name"),
        phone: phone(),
        relationship: relationship ?? undefined,
        isPrimaryContact: primary ?? undefined,
      };
      break;
    }
    case "staff": {
      const roles: StaffRole[] = [];
      for (const part of get("roles").split(";").map(clean).filter(Boolean)) {
        const role = matchEnum(STAFF_ROLES, part);
        if (!role)
          errors.push({
            row,
            field: "roles",
            message: `Unknown role "${part}". Use ${STAFF_ROLES.join(", ")} separated by ;.`,
          });
        else if (!roles.includes(role)) roles.push(role);
      }
      const listed = [...new Set(get("class_names").split(";").map(clean).filter(Boolean))];
      const classNames = listed.length > 0 ? listed : undefined;
      if (listed.length > 20)
        errors.push({ row, field: "class_names", message: "List at most 20 classes." });
      const staffYear = year();
      if (listed.length > 0 && staffYear === undefined && get("year") === "")
        errors.push({ row, field: "year", message: "Enter the year for the listed classes." });
      data = {
        email: email("email"),
        firstName: get("first_name"),
        lastName: get("last_name"),
        phone: phone(),
        roles,
        classNames,
        year: staffYear,
      };
      break;
    }
  }
  return errors.length > 0 ? { errors } : { data: data as ImportRowFor<K>, errors };
}

/**
 * Parses a whole CSV file for one import kind: checks the header against the
 * template, validates every row and reports duplicates of a natural key
 * within the file (the second and later occurrences are rejected).
 */
export function parseImportCsv<K extends ImportKind>(kind: K, text: string): ImportParseResult<K> {
  let records: { row: number; cells: string[] }[];
  try {
    records = parseCsvRecords(text);
  } catch (error) {
    return {
      kind,
      rows: [],
      errors: [{ row: 1, message: (error as Error).message }],
      totalRows: 0,
    };
  }
  if (records.length === 0)
    return { kind, rows: [], errors: [{ row: 1, message: "The file is empty." }], totalRows: 0 };
  const header = records[0]!.cells.map((h) => clean(h).toLowerCase());
  const template = IMPORT_TEMPLATES[kind];
  const missing = template.filter((name) => !header.includes(name));
  const unknown = header.filter((name) => !template.includes(name));
  if (missing.length > 0 || unknown.length > 0) {
    const parts = [
      missing.length > 0 ? `missing columns: ${missing.join(", ")}` : "",
      unknown.length > 0 ? `unknown columns: ${unknown.join(", ")}` : "",
    ].filter(Boolean);
    return {
      kind,
      rows: [],
      errors: [
        {
          row: records[0]!.row,
          message: `The header does not match the ${kind} template (${parts.join("; ")}).`,
        },
      ],
      totalRows: records.length - 1,
    };
  }
  const body = records.slice(1);
  if (body.length > IMPORT_MAX_ROWS)
    return {
      kind,
      rows: [],
      errors: [{ row: 1, message: `Import at most ${IMPORT_MAX_ROWS} rows per file.` }],
      totalRows: body.length,
    };
  const rows: ImportValidRow<K>[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Map<string, number>();
  body.forEach(({ row, cells: record }) => {
    if (record.length > header.length) {
      errors.push({ row, message: "This row has more cells than the header." });
      return;
    }
    const cells = Object.fromEntries(header.map((name, i) => [name, record[i] ?? ""]));
    const result = validateImportRow(kind, cells, row);
    errors.push(...result.errors);
    if (!result.data) return;
    const key = importRowKey(kind, result.data);
    const first = seen.get(key);
    if (first !== undefined) {
      errors.push({ row, message: `Duplicate of row ${first}.` });
      return;
    }
    seen.set(key, row);
    rows.push({ row, key, data: result.data });
  });
  return { kind, rows, errors, totalRows: body.length };
}

// ── Class imports (Teachers and Principals, from a class folder) ─────────────
// One simpler file per class: the class, grade and year come from the folder
// the teacher opened, and an optional parent per learner sits on the same row.
// The rows are turned into ordinary `learners` and `guardians` import cells, so
// the server applies exactly the same validation and the same commit path.

/** Header row of the class import template, in column order. */
export const CLASS_IMPORT_TEMPLATE = [
  "learner_number",
  "first_name",
  "last_name",
  "preferred_name",
  "date_of_birth",
  "parent_email",
  "parent_first_name",
  "parent_last_name",
  "parent_phone",
  "parent_relationship",
] as const;
const CLASS_IMPORT_REQUIRED = ["learner_number", "first_name", "last_name"] as const;
const PARENT_FIELDS: Record<string, string> = {
  email: "parent_email",
  first_name: "parent_first_name",
  last_name: "parent_last_name",
  phone: "parent_phone",
  relationship: "parent_relationship",
};

export interface ClassImportTarget {
  grade: string;
  className: string;
  year: number;
}
export interface ClassImportRow {
  row: number;
  learnerNumber: string;
  name: string;
  /** Cells for a `learners` import row. */
  learner: Record<string, string>;
  /** Cells for a `guardians` import row when the parent columns are filled in. */
  guardian?: Record<string, string>;
}
export interface ClassImportResult {
  rows: ClassImportRow[];
  errors: ImportRowError[];
  totalRows: number;
}

export function classImportTemplateCsv(): string {
  return `${CLASS_IMPORT_TEMPLATE.join(",")}\r\n`;
}

/**
 * Parses a class import file. Only learner_number, first_name and last_name
 * columns are required; the parent columns are optional, but a row that fills
 * any of them must give the parent's email, names and relationship.
 */
export function parseClassImportCsv(text: string, target: ClassImportTarget): ClassImportResult {
  const fail = (message: string, totalRows = 0): ClassImportResult => ({
    rows: [],
    errors: [{ row: 1, message }],
    totalRows,
  });
  let records: { row: number; cells: string[] }[];
  try {
    records = parseCsvRecords(text);
  } catch (error) {
    return fail((error as Error).message);
  }
  if (records.length === 0) return fail("The file is empty.");
  const header = records[0]!.cells.map((h) => clean(h).toLowerCase());
  const known: readonly string[] = CLASS_IMPORT_TEMPLATE;
  const missing = CLASS_IMPORT_REQUIRED.filter((name) => !header.includes(name));
  const unknown = header.filter((name) => !known.includes(name));
  if (missing.length > 0 || unknown.length > 0)
    return fail(
      `The header does not match the class template (${[
        missing.length > 0 ? `missing columns: ${missing.join(", ")}` : "",
        unknown.length > 0 ? `unknown columns: ${unknown.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ")}).`,
      records.length - 1,
    );
  const body = records.slice(1);
  if (body.length > IMPORT_MAX_ROWS)
    return fail(`Import at most ${IMPORT_MAX_ROWS} rows per file.`, body.length);

  const rows: ClassImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Map<string, number>();
  for (const { row, cells: record } of body) {
    if (record.length > header.length) {
      errors.push({ row, message: "This row has more cells than the header." });
      continue;
    }
    const cells = Object.fromEntries(header.map((name, i) => [name, clean(record[i])]));
    const cell = (name: string) => cells[name] ?? "";
    const learner = {
      learner_number: cell("learner_number"),
      first_name: cell("first_name"),
      last_name: cell("last_name"),
      preferred_name: cell("preferred_name"),
      date_of_birth: cell("date_of_birth"),
      grade: target.grade,
      class_name: target.className,
      year: String(target.year),
    };
    const learnerCheck = validateImportRow("learners", learner, row);
    const rowErrors = [...learnerCheck.errors];
    let guardian: Record<string, string> | undefined;
    if (Object.values(PARENT_FIELDS).some((name) => cell(name) !== "")) {
      guardian = {
        learner_number: learner.learner_number,
        email: cell("parent_email"),
        first_name: cell("parent_first_name"),
        last_name: cell("parent_last_name"),
        phone: cell("parent_phone"),
        relationship: cell("parent_relationship"),
        primary_contact: "",
      };
      const guardianCheck = validateImportRow("guardians", guardian, row);
      rowErrors.push(
        ...guardianCheck.errors
          .filter((e) => e.field !== "learner_number")
          .map((e) => (e.field ? { ...e, field: PARENT_FIELDS[e.field] ?? e.field } : e)),
      );
    }
    if (rowErrors.length > 0 || !learnerCheck.data) {
      errors.push(...rowErrors);
      continue;
    }
    const data = learnerCheck.data;
    const first = seen.get(data.learnerNumber);
    if (first !== undefined) {
      errors.push({ row, message: `Duplicate of row ${first}.` });
      continue;
    }
    seen.set(data.learnerNumber, row);
    rows.push({
      row,
      learnerNumber: data.learnerNumber,
      name: `${data.preferredName ?? data.firstName} ${data.lastName}`,
      learner,
      ...(guardian ? { guardian } : {}),
    });
  }
  return { rows, errors, totalRows: body.length };
}
