import type { SchoolModule } from "./permissions";

/** Provider-independent presentation contract for the first live module reads. */
export interface ModuleRecord {
  id: string;
  title: string;
  body: string;
  subtitle: string;
  status: string;
  at: number | null;
  amountCents: number | null;
  read: boolean;
  acknowledged: boolean;
  canAcknowledge: boolean;
  canMarkRead?: boolean;
  category?: string;
  endsAt?: number;
  allDay?: boolean;
  pending?: boolean;
  requiresAcknowledgement?: boolean;
  fields?: { label: string; value: string }[];
  /** Staff-only preview media (Ad Center); parents receive ads through PublicAd. */
  media?: { url: string; kind: "image" | "video" };
}
/** A published ad visible to the signed-in viewer. Never includes storage IDs. */
export interface PublicAd {
  id: string;
  title: string;
  caption: string;
  linkUrl: string | null;
  linkLabel: string | null;
  popup: boolean;
  revision: number;
  startsAt: number;
  endsAt: number;
  /** Ordered slides (pictures and videos) for this ad. */
  items: { url: string; kind: "image" | "video"; contentType: string }[];
}
/** One uploaded Ad Center item, as shown to the ad's editors. */
/** Ad engagement counters; `viewers` is distinct parents (per day, or lifetime in totals). */
export interface AdCounters {
  impressions: number;
  popupViews: number;
  clicks: number;
  viewers: number;
}
/** Ad Center performance for editors: lifetime totals and recent days (days since epoch, SAST). */
export interface AdStats {
  totals: AdCounters;
  days: (AdCounters & { day: number })[];
}
export type AdEvent = "banner" | "popup" | "click";
export interface AdMediaItem {
  id: string;
  url: string;
  kind: "image" | "video";
  contentType: string;
  fileName: string;
  size: number;
}
export interface ModulePage {
  records: ModuleRecord[];
  truncated: boolean;
}
export interface ModuleRequest {
  module: SchoolModule;
  learnerId?: string;
}

export const RELATED_MODULES = [
  "invitations",
  "noticeReceipts",
  "classes",
  "classLearners",
  "timetable",
  "attendanceMarks",
  "paymentHistory",
  "enquiryMessages",
  "formResponses",
] as const;
export type ReadModule = SchoolModule | (typeof RELATED_MODULES)[number];
export interface ReadOptions {
  manage?: boolean;
  search?: string;
  canMarkRead?: boolean;
  category?: string;
  from?: number;
  to?: number;
  classId?: string;
  parentId?: string;
  outstandingOnly?: boolean;
}
export interface RecordDetail {
  record: ModuleRecord;
  related: { module: ReadModule; title: string; learnerId?: string; parentId?: string }[];
}
export interface DashboardState {
  ready: boolean;
  progress: number;
  revision: string;
  unread: number | null;
  pendingActions: number;
  upcomingEvents: number | null;
  amountDueCents: number | null;
}

/** Staff Learners folders: group class records (grade, order, teacher, learner count) by grade. */
export type ClassFolder = {
  id: string;
  name: string;
  label: string;
  grade: string;
  gradeOrder: number;
  teacher: string | null;
  learners: string;
  /** Academic year (class records carry it as their status), or null when unknown. */
  year: number | null;
};
export type GradeFolder = { name: string; order: number; classes: ClassFolder[]; learners: number };

const recordField = (r: ModuleRecord, label: string) => {
  const v = r.fields?.find((f) => f.label === label)?.value;
  return v && v !== "Not provided" ? v : null;
};
/** "1A" in "Grade 1" reads as "Grade 1A"; other names keep their grade for context. */
export function classLabel(grade: string, name: string) {
  if (/^grade\b/i.test(name)) return name;
  if (/^\d/.test(name)) return `Grade ${name}`;
  return `${grade} · ${name}`;
}
export function groupClasses(records: ModuleRecord[]): GradeFolder[] {
  const grades = new Map<string, GradeFolder>();
  for (const r of records) {
    const grade = recordField(r, "Grade") ?? r.category ?? "Unassigned grade";
    const folder: ClassFolder = {
      id: r.id,
      name: r.title,
      label: classLabel(grade, r.title),
      grade,
      gradeOrder: Number(recordField(r, "Grade order") ?? 999),
      teacher: recordField(r, "Class teacher"),
      learners: recordField(r, "Learners") ?? "0",
      year: /^\d{4}$/.test(r.status) ? Number(r.status) : null,
    };
    const g = grades.get(grade) ?? {
      name: grade,
      order: folder.gradeOrder,
      classes: [],
      learners: 0,
    };
    g.classes.push(folder);
    g.learners += Number.parseInt(folder.learners, 10) || 0;
    grades.set(grade, g);
  }
  return [...grades.values()]
    .map((g) => ({ ...g, classes: g.classes.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
/** "1 learner", "5 learners". */
export function countLabel(count: number | string, word: string) {
  return `${count} ${word}${String(count) === "1" ? "" : "s"}`;
}
