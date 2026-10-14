import { children, visibleNotices, type SchoolState } from "@school-connect/core";
export function familyView(state: SchoolState, child: string) {
  const notices = visibleNotices(state, "Parent", child);
  const hasEmma = child === "all" || child === "emma";
  return {
    notices,
    unread: notices.filter((n) => !n.read).length,
    consentDue: hasEmma && !state.consent ? 1 : 0,
    amountDue: hasEmma && state.payment !== "Paid" ? 250 : 0,
    events: state.events.filter(
      (e) =>
        e.audience === "Whole school" ||
        child === "all" ||
        e.audience === children.find((c) => c.id === child)?.grade,
    ),
  };
}
export function consentError(phone: string, permission: boolean) {
  if (phone.replace(/\D/g, "").length < 10)
    return "Enter an emergency contact number with at least 10 digits.";
  if (!permission) return "Please confirm permission before submitting.";
  return "";
}
export function markNotice(state: SchoolState, id: string, acknowledge = false): SchoolState {
  return {
    ...state,
    notices: state.notices.map((n) =>
      n.id === id && n.status === "Published"
        ? { ...n, read: true, acknowledged: acknowledge || (n.acknowledged ?? false) }
        : n,
    ),
  };
}
export type PaymentOutcome = "Paid" | "Failed" | "Pending verification";
