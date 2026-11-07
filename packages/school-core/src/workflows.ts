export const WORKFLOW_ACTIONS = [
  "noticeSave",
  "noticeReview",
  "noticeReturn",
  "noticePublish",
  "noticeSchedule",
  "noticeArchive",
  "eventSave",
  "eventCancel",
  "consentCreate",
  "consentRespond",
  "enquiryCreate",
  "enquiryReply",
  "enquiryAssign",
  "enquiryResolve",
  "enquiryReopen",
  "attendanceSave",
  "attendanceSubmit",
  "conductCreate",
  "noticeAttach",
  "noticeDownload",
  "noticeRemoveAttachment",
  "resourceCreate",
  "resourceDownload",
  "resourcePublish",
  "resourceArchive",
  "receiptDownload",
  "reportCreate",
  "reportReview",
  "reportRelease",
  "reportDownload",
  "personClass",
  "personRole",
  "personStatus",
  "invitationRevoke",
  "settingsSave",
  "profileSave",
  "invite",
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];
export interface WorkflowField {
  name: string;
  label: string;
  type: "text" | "multiline" | "select" | "toggle" | "datetime" | "date" | "file";
  value: string;
  required: boolean;
  options?: { value: string; label: string }[];
}
export interface WorkflowForm {
  targetId?: string;
  action: WorkflowAction;
  title: string;
  description: string;
  fields: WorkflowField[];
  confirm?: boolean;
}
export type WorkflowInput = {
  action: WorkflowAction;
  itemId?: string | undefined;
  values: Record<string, string>;
};
export interface WorkflowFile {
  name: string;
  bytes: ArrayBuffer;
}
export interface WorkflowOutcome {
  id: string;
  file?: WorkflowFile;
  download?: { url: string; name: string; contentType: string; expiresAt: number };
}
