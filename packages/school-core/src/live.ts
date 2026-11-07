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
