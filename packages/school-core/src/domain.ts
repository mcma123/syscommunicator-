// Shared enum values for the web app, the Expo app and the Convex backend.
// Plain `as const` tuples keep this file provider-independent; the backend
// builds its validators from them, so all three always agree on the values.

export const STAFF_ROLES = ["Teacher", "Principal", "Finance", "Administrator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const ROLES = ["Parent", ...STAFF_ROLES] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["Active", "Deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const GUARDIAN_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Other",
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const LEARNER_STATUSES = ["Active", "Withdrawn", "Graduated"] as const;
export type LearnerStatus = (typeof LEARNER_STATUSES)[number];

export const NOTICE_CATEGORIES = ["Academic", "Sport", "General", "Events"] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];
export const NOTICE_STATUSES = ["Draft", "Review", "Published", "Scheduled", "Archived"] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export const EVENT_STATUSES = ["Scheduled", "Cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const RESOURCE_CATEGORIES = [
  "Newsletters",
  "School documents",
  "Academic",
  "Forms",
  "Policies",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export const PUBLISH_STATUSES = ["Draft", "Published", "Archived"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

/** Ad Center: teachers submit for Review; Principal/Administrator publish. */
export const AD_STATUSES = ["Draft", "Review", "Published", "Archived"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];
export const AD_MEDIA_KINDS = ["image", "video"] as const;
/** Advertiser pipeline: enquiry → in conversation → paying → ended; Unsubscribed stops all marketing. */
export const ADVERTISER_STATUSES = [
  "Lead",
  "Contacted",
  "Active",
  "Lapsed",
  "Unsubscribed",
] as const;
export type AdvertiserStatus = (typeof ADVERTISER_STATUSES)[number];
export const ADVERTISER_SOURCES = ["Website", "Staff"] as const;
export type AdvertiserSource = (typeof ADVERTISER_SOURCES)[number];
export const AD_MEDIA_STATUSES = ["Pending", "Ready"] as const;
export type AdMediaStatus = (typeof AD_MEDIA_STATUSES)[number];
export type AdMediaKind = (typeof AD_MEDIA_KINDS)[number];

export const REPORT_STATUSES = ["Draft", "Reviewed", "Released"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REGISTER_STATUSES = ["Open", "Submitted"] as const;
export type RegisterStatus = (typeof REGISTER_STATUSES)[number];
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const CONDUCT_TYPES = ["Merit", "Demerit", "Note"] as const;
export type ConductType = (typeof CONDUCT_TYPES)[number];

export const CONSENT_REQUEST_STATUSES = ["Open", "Closed"] as const;
export type ConsentRequestStatus = (typeof CONSENT_REQUEST_STATUSES)[number];
export const CONSENT_DECISIONS = ["Granted", "Declined"] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

// A charge is what a family owes; a payment is one attempt to settle it.
export const CHARGE_STATUSES = [
  "Due",
  "Pending verification",
  "Paid",
  "Failed",
  "Refunded",
  "Cancelled",
] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];
export const PAYMENT_STATUSES = ["Pending", "Succeeded", "Failed", "Refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEPARTMENTS = [
  "Administration",
  "Finance",
  "Academic",
  "Sport",
  "Pastoral care",
] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const ENQUIRY_STATUSES = ["Open", "Assigned", "Resolved"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const INVITATION_KINDS = ["Staff", "Guardian"] as const;
export type InvitationKind = (typeof INVITATION_KINDS)[number];
export const INVITATION_STATUSES = ["Pending", "Accepted", "Revoked", "Expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const PUSH_PLATFORMS = ["ios", "android", "web"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

// Who a notice, event or resource is addressed to.
export const AUDIENCE_KINDS = ["School", "Grade", "Class", "Group"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];
export const NOTIFICATION_KINDS = ["Notice", "ConsentReminder"] as const;
export const NOTIFICATION_CHANNELS = ["Push", "Email"] as const;
export const NOTIFICATION_STATES = [
  "Pending",
  "Deferred",
  "Sending",
  "Accepted",
  "Delivered",
  "Failed",
  "Blocked",
  "Skipped",
] as const;

// Phase 11 roster import. Staged contacts never grant access on their own;
// activation into accounts is a separate, later Administrator step.
export const ROSTER_CONTACT_KINDS = ["Guardian", "Staff"] as const;
export type RosterContactKind = (typeof ROSTER_CONTACT_KINDS)[number];
export const IMPORT_BATCH_STATUSES = ["Open", "Completed"] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];
