import type { WorkflowForm, WorkflowInput, WorkflowFile } from "@school-connect/core/workflows";
import type {
  ModulePage,
  ModuleRecord,
  RecordDetail,
  ReadModule,
  ReadOptions,
  DashboardState,
} from "@school-connect/core/live";
import type { SchoolModule } from "@school-connect/core/permissions";
import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { Doc, Id } from "./convex/_generated/dataModel";
import type { ImportBatchStatus, StaffRole } from "@school-connect/core/domain";
import type { ImportKind } from "@school-connect/core/imports";

/** Public client contract. Keeps internal server implementation out of client TS programs. */
export interface CurrentIdentity {
  id: Id<"users">;
  name: string;
  email: string;
  status: "Active" | "Deactivated" | "Revoked";
  disabledModules?: string[];
  roles: StaffRole[];
  learners: { id: Id<"learners">; name: string; gradeId: Id<"grades">; classId: Id<"classes"> }[];
}
export type InvitationInput = {
  email: string;
  kind: "Guardian" | "Staff";
  staffRole?: StaffRole;
  learnerIds: Id<"learners">[];
};
export type ReadInput = Omit<ReadOptions, "classId" | "parentId"> & {
  module: ReadModule;
  learnerId?: Id<"learners">;
  classId?: Id<"classes">;
  parentId?:
    | Id<"charges">
    | Id<"enquiries">
    | Id<"attendanceRegisters">
    | Id<"classes">
    | Id<"consentRequests">
    | Id<"notices">;
};
export type RecordId =
  | Id<"invitations">
  | Id<"noticeReceipts">
  | Id<"notices">
  | Id<"events">
  | Id<"learners">
  | Id<"resources">
  | Id<"charges">
  | Id<"payments">
  | Id<"consentRequests">
  | Id<"consentResponses">
  | Id<"enquiries">
  | Id<"enquiryMessages">
  | Id<"reports">
  | Id<"conductEntries">
  | Id<"attendanceRegisters">
  | Id<"attendanceMarks">
  | Id<"timetablePeriods">
  | Id<"classes">
  | Id<"groups">
  | Id<"users">
  | Id<"auditLog">
  | Id<"schools">;
export type PublicFile = { fileName: string; contentType: string; size: number };
export type PublicNotice = Omit<Doc<"notices">, "attachments"> & { attachments: PublicFile[] };
export type PublicResource = Omit<Doc<"resources">, "file"> & { file: PublicFile };
export type FileTarget = {
  kind: "notice" | "resource" | "report" | "receipt";
  id: string;
  slot?: number;
};
export type UploadSpec = {
  kind: "notice" | "resource" | "report";
  targetId?: string;
  values: Record<string, string>;
};
export type DownloadLink = { url: string; name: string; contentType: string; expiresAt: number };
export interface NotificationDelivery {
  id: Id<"notificationDeliveries">;
  name: string;
  kind: "Notice" | "ConsentReminder";
  channel: "Push" | "Email";
  state: (typeof import("@school-connect/core/domain").NOTIFICATION_STATES)[number];
  reason?: string;
  at: number;
  canRetry: boolean;
}
export interface NotificationConfiguration {
  enabled: boolean;
  emailConfigured: boolean;
  pushConfigured: boolean;
  registeredDevices: number;
}
export type ImportRowInput = { row: number; cells: Record<string, string> };
export type ImportRowResult = {
  row: number;
  outcome: "create" | "update" | "unchanged" | "rejected";
  messages: string[];
};
export type ImportBatchSummary = {
  _id: Id<"importBatches">;
  _creationTime: number;
  kind: ImportKind;
  fileName: string;
  status: ImportBatchStatus;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
};
export const api = {
  imports: {
    preview: makeFunctionReference<
      "query",
      { kind: ImportKind; rows: ImportRowInput[] },
      ImportRowResult[]
    >("imports:preview"),
    commit: makeFunctionReference<
      "mutation",
      {
        kind: ImportKind;
        fileName: string;
        totalRows: number;
        batchId?: Id<"importBatches">;
        rows: ImportRowInput[];
      },
      { batchId: Id<"importBatches">; results: ImportRowResult[] }
    >("imports:commit"),
    complete: makeFunctionReference<"mutation", { batchId: Id<"importBatches"> }, null>(
      "imports:complete",
    ),
    batches: makeFunctionReference<"query", Record<string, never>, ImportBatchSummary[]>(
      "imports:batches",
    ),
  },
  notifications: {
    registerDevice: makeFunctionReference<
      "mutation",
      { token: string; platform: "ios" | "android"; projectId: string },
      null
    >("notifications:registerDevice"),
    unregisterDevice: makeFunctionReference<"mutation", { token?: string }, null>(
      "notifications:unregisterDevice",
    ),
    configuration: makeFunctionReference<"query", Record<string, never>, NotificationConfiguration>(
      "notifications:configuration",
    ),
    history: makeFunctionReference<
      "query",
      { noticeId?: Id<"notices">; paginationOpts: PaginationOptions },
      PaginationResult<NotificationDelivery>
    >("notifications:history"),
    retry: makeFunctionReference<"mutation", { deliveryId: Id<"notificationDeliveries"> }, null>(
      "notifications:retry",
    ),
  },
  files: {
    beginUpload: makeFunctionReference<
      "mutation",
      { spec: UploadSpec; fileName: string; contentType: string; size: number; sha256: string },
      { uploadId: Id<"fileUploads">; uploadUrl: string }
    >("files:beginUpload"),
    claimUpload: makeFunctionReference<
      "mutation",
      { uploadId: Id<"fileUploads">; storageId: Id<"_storage"> },
      null
    >("files:claimUpload"),
    finishUpload: makeFunctionReference<"action", { uploadId: Id<"fileUploads"> }, string>(
      "files:finishUpload",
    ),
    prepareDownload: makeFunctionReference<
      "action",
      { target: FileTarget },
      { grantId: Id<"fileGrants">; token: string }
    >("files:prepareDownload"),
    downloadUrl: makeFunctionReference<
      "query",
      { grantId: Id<"fileGrants">; token: string; now: number },
      DownloadLink
    >("files:downloadUrl"),
    resourceStatus: makeFunctionReference<
      "mutation",
      { resourceId: Id<"resources">; publish: boolean },
      string
    >("files:resourceStatus"),
    removeAttachment: makeFunctionReference<
      "mutation",
      { noticeId: Id<"notices">; slot: number },
      string
    >("files:removeAttachment"),
  },
  receiptFiles: {
    generate: makeFunctionReference<"action", { receiptId: Id<"receipts"> }, Id<"receipts">>(
      "receiptFiles:generate",
    ),
  },
  workflowForms: {
    forms: makeFunctionReference<
      "query",
      { module: ReadModule; itemId?: RecordId; learnerId?: Id<"learners"> },
      WorkflowForm[]
    >("workflowForms:forms"),
  },
  workflows: {
    submit: makeFunctionReference<
      "mutation",
      Omit<WorkflowInput, "itemId"> & { itemId?: RecordId },
      string
    >("workflows:submit"),
    uploadReport: makeFunctionReference<
      "action",
      {
        learnerId: Id<"learners">;
        title: string;
        term: string;
        fileName: string;
        bytes: ArrayBuffer;
      },
      Id<"reports">
    >("workflows:uploadReport"),
    reportFile: makeFunctionReference<"action", { reportId: Id<"reports"> }, WorkflowFile>(
      "workflows:reportFile",
    ),
  },
  schoolRead: {
    page: makeFunctionReference<
      "query",
      ReadInput & { paginationOpts: PaginationOptions },
      PaginationResult<ModuleRecord>
    >("schoolRead:page"),
    detail: makeFunctionReference<"query", ReadInput & { itemId: RecordId }, RecordDetail>(
      "schoolRead:detail",
    ),
  },
  dashboard: {
    current: makeFunctionReference<
      "query",
      { learnerId?: Id<"learners">; now: number },
      DashboardState
    >("dashboard:current"),
    advance: makeFunctionReference<"action", { learnerId?: Id<"learners"> }, null>(
      "dashboard:advance",
    ),
  },
  schoolData: {
    list: makeFunctionReference<
      "query",
      { module: SchoolModule; learnerId?: Id<"learners"> },
      ModulePage
    >("schoolData:list"),
  },
  notices: {
    setReceipt: makeFunctionReference<
      "mutation",
      { noticeId: Id<"notices">; acknowledge: boolean },
      null
    >("notices:setReceipt"),
    get: makeFunctionReference<"query", { noticeId: Id<"notices"> }, PublicNotice>("notices:get"),
    listForMe: makeFunctionReference<
      "query",
      { paginationOpts: PaginationOptions },
      PaginationResult<PublicNotice>
    >("notices:listForMe"),
  },
  learners: {
    get: makeFunctionReference<"query", { learnerId: Id<"learners"> }, Doc<"learners">>(
      "learners:get",
    ),
    listForClass: makeFunctionReference<"query", { classId: Id<"classes"> }, Doc<"learners">[]>(
      "learners:listForClass",
    ),
  },
  charges: {
    get: makeFunctionReference<"query", { chargeId: Id<"charges"> }, Doc<"charges">>("charges:get"),
  },
  resources: {
    get: makeFunctionReference<"query", { resourceId: Id<"resources"> }, PublicResource>(
      "resources:get",
    ),
  },
  users: {
    current: makeFunctionReference<"query", Record<string, never>, CurrentIdentity | null>(
      "users:current",
    ),
    configuration: makeFunctionReference<
      "query",
      Record<string, never>,
      { emailReady: boolean; demoEnabled: boolean }
    >("users:configuration"),
    signOutEverywhere: makeFunctionReference<"action", Record<string, never>, null>(
      "users:signOutEverywhere",
    ),
  },
  onboarding: {
    invite: makeFunctionReference<"action", InvitationInput, Id<"invitations">>(
      "onboarding:invite",
    ),
    accept: makeFunctionReference<"mutation", { token: string }, null>("onboarding:accept"),
    invitationOptions: makeFunctionReference<
      "query",
      Record<string, never>,
      { id: Id<"learners">; name: string }[]
    >("onboarding:invitationOptions"),
  },
};
