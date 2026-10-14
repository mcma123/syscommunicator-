export const modules = [
  { id: "messages", title: "Messages", description: "School notices and updates" },
  { id: "calendar", title: "Calendar", description: "School events and important dates" },
  { id: "children", title: "My children", description: "Learner information and milestones" },
  { id: "resources", title: "Resources", description: "Newsletters and school documents" },
  { id: "payments", title: "Payments", description: "School fees and activities" },
  { id: "forms", title: "Forms & consent", description: "Permissions and family responses" },
  { id: "contact", title: "Contact school", description: "Departmental enquiries" },
  { id: "more", title: "More", description: "All your school modules" },
  { id: "profile", title: "Profile", description: "Your details and notifications" },
  { id: "signin", title: "Welcome", description: "Invitation and sign-in preview" },
  { id: "groups", title: "Groups & classes", description: "Class and activity groups" },
  { id: "attendance", title: "Attendance", description: "Learner attendance registers" },
  { id: "conduct", title: "Conduct", description: "Achievements and pastoral notes" },
  { id: "reports", title: "Reports", description: "Learner reports and release workflow" },
  { id: "people", title: "People & invitations", description: "Families and staff" },
  { id: "settings", title: "School settings", description: "School identity and modules" },
  { id: "audit", title: "Audit log", description: "School activity records" },
] as const;

export type ModuleId = (typeof modules)[number]["id"];
