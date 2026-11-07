import { v, type VLiteral, type VUnion } from "convex/values";
import {
  ATTENDANCE_STATUSES,
  CHARGE_STATUSES,
  CONDUCT_TYPES,
  CONSENT_DECISIONS,
  CONSENT_REQUEST_STATUSES,
  DEPARTMENTS,
  ENQUIRY_STATUSES,
  EVENT_STATUSES,
  GUARDIAN_RELATIONSHIPS,
  INVITATION_KINDS,
  INVITATION_STATUSES,
  LEARNER_STATUSES,
  NOTICE_CATEGORIES,
  NOTICE_STATUSES,
  PAYMENT_STATUSES,
  PUBLISH_STATUSES,
  PUSH_PLATFORMS,
  REGISTER_STATUSES,
  REPORT_STATUSES,
  RESOURCE_CATEGORIES,
  STAFF_ROLES,
  USER_STATUSES,
} from "@school-connect/core/domain";

/** Builds a `v.union` of literals from a shared `as const` tuple in school-core. */
export function literals<T extends string>(
  values: readonly [T, ...T[]],
): VUnion<T, VLiteral<T, "required">[], "required", never> {
  return v.union(...values.map((value) => v.literal(value))) as VUnion<
    T,
    VLiteral<T, "required">[],
    "required",
    never
  >;
}

export const staffRole = literals(STAFF_ROLES);
export const userStatus = literals(USER_STATUSES);
export const guardianRelationship = literals(GUARDIAN_RELATIONSHIPS);
export const learnerStatus = literals(LEARNER_STATUSES);
export const noticeCategory = literals(NOTICE_CATEGORIES);
export const noticeStatus = literals(NOTICE_STATUSES);
export const eventStatus = literals(EVENT_STATUSES);
export const resourceCategory = literals(RESOURCE_CATEGORIES);
export const publishStatus = literals(PUBLISH_STATUSES);
export const reportStatus = literals(REPORT_STATUSES);
export const registerStatus = literals(REGISTER_STATUSES);
export const attendanceStatus = literals(ATTENDANCE_STATUSES);
export const conductType = literals(CONDUCT_TYPES);
export const consentRequestStatus = literals(CONSENT_REQUEST_STATUSES);
export const consentDecision = literals(CONSENT_DECISIONS);
export const chargeStatus = literals(CHARGE_STATUSES);
export const paymentStatus = literals(PAYMENT_STATUSES);
export const department = literals(DEPARTMENTS);
export const enquiryStatus = literals(ENQUIRY_STATUSES);
export const invitationKind = literals(INVITATION_KINDS);
export const invitationStatus = literals(INVITATION_STATUSES);
export const pushPlatform = literals(PUSH_PLATFORMS);

/** One target of a notice, event or resource. Stored as a short, bounded array. */
export const audience = v.union(
  v.object({ kind: v.literal("School") }),
  v.object({ kind: v.literal("Grade"), gradeId: v.id("grades") }),
  v.object({ kind: v.literal("Class"), classId: v.id("classes") }),
  v.object({ kind: v.literal("Group"), groupId: v.id("groups") }),
);

/** File metadata kept next to a Convex storage ID. */
export const attachment = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.string(),
  size: v.number(),
});
