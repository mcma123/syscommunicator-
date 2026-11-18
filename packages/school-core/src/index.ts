import type { NoticeCategory, NoticeStatus, Role } from "./domain";
export * from "./domain";
export * from "./permissions";
export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  audience: string;
  date: string;
  author: string;
  status: NoticeStatus;
  urgent?: boolean;
  attachment?: string;
  action?: "consent";
  read?: boolean;
  acknowledged?: boolean;
}
export interface Child {
  id: string;
  name: string;
  grade: string;
  className: string;
  initials: string;
  teacher: string;
}
export interface SchoolEvent {
  id: string;
  title: string;
  day: number;
  month: string;
  time: string;
  location: string;
  category: string;
  audience: string;
}
export interface Enquiry {
  id: string;
  subject: string;
  department: string;
  status: "Open" | "Assigned" | "Resolved";
  messages: { author: string; body: string }[];
}
export interface SchoolState {
  notices: Notice[];
  consent: boolean;
  payment: "Due" | "Pending verification" | "Paid" | "Failed";
  enquiries: Enquiry[];
  events: SchoolEvent[];
  notifications: boolean;
  reportReleased: boolean;
  attendance: Record<string, boolean>;
  conduct: { title: string; type: string; child: string }[];
  resources: { title: string; category: string; size: string }[];
  invited: string[];
}
export interface SchoolRepository {
  getSnapshot(): SchoolState;
  update(fn: (state: SchoolState) => SchoolState): void;
  subscribe(listener: () => void): () => void;
}
export const schoolConfig = {
  name: "Wynberg Girls Junior School",
  appName: "Syscommunicator",
  shortName: "Syscommunicator",
  subtitle: "Honor Before Honours",
  logoUrl: "/logo.png",
  websiteUrl: "https://wynberggirlsjunior.co.za/",
  timezone: "Africa/Johannesburg",
  currency: "ZAR",
  term: "Term 4, 2026",
  clothingStoreUrl: "https://www.schoolandlife.com/",
};
export const children: Child[] = [
  {
    id: "emma",
    name: "Emma Williams",
    grade: "Grade 4",
    className: "4B",
    initials: "EW",
    teacher: "Ms Sarah Jacobs",
  },
  {
    id: "noah",
    name: "Noah Williams",
    grade: "Grade 1",
    className: "1A",
    initials: "NW",
    teacher: "Mrs Naledi Mokoena",
  },
];
export const initialState: SchoolState = {
  notices: [
    {
      id: "excursion",
      title: "Grade 4 adventure awaits!",
      body: "Our Grade 4 learners are heading to the Johannesburg Botanical Gardens for a day of discovery on 23 October. Please complete the consent form and activity payment by 20 October. Learners should bring a packed lunch, water bottle and sun hat. We will depart at 08:00 and return by 14:00.",
      category: "Academic",
      audience: "Grade 4",
      date: "14 Oct 2026",
      author: "Ms Sarah Jacobs",
      status: "Published",
      attachment: "Grade 4 excursion information.pdf",
      action: "consent",
    },
    {
      id: "sports",
      title: "Ready, set, sports day",
      body: "Join us on the school field this Friday for our annual inter-house sports day. Families are welcome from 08:30. Please wear your house colours and bring your school spirit! Refreshments will be available.",
      category: "Sport",
      audience: "Whole school",
      date: "14 Oct 2026",
      author: "Sports Department",
      status: "Published",
    },
    {
      id: "newsletter",
      title: "A little look at our week",
      body: "From wonderful reading milestones to creative science projects, it has been a busy week. Thank you to our school community for your continued support. Read our Term 4 newsletter for all the highlights.",
      category: "General",
      audience: "Whole school",
      date: "13 Oct 2026",
      author: "School Office",
      status: "Published",
      attachment: "Weekly newsletter · Week 2.pdf",
    },
    {
      id: "reading",
      title: "Reading together, growing together",
      body: "Our Grade 1 reading morning is on 21 October. Please join your child in the classroom from 07:30 for a special shared reading session.",
      category: "Academic",
      audience: "Grade 1",
      date: "12 Oct 2026",
      author: "Mrs Naledi Mokoena",
      status: "Published",
    },
    {
      id: "draft",
      title: "Grade 4 assessment preparation",
      body: "Private draft: assessment topics for the upcoming mathematics assessment.",
      category: "Academic",
      audience: "Grade 4",
      date: "14 Oct 2026",
      author: "Ms Sarah Jacobs",
      status: "Draft",
    },
  ],
  consent: false,
  payment: "Due",
  notifications: true,
  reportReleased: false,
  enquiries: [
    {
      id: "finance",
      subject: "October fee statement",
      department: "Finance",
      status: "Open",
      messages: [
        {
          author: "You",
          body: "Good morning. Could you please send an updated fee statement for Emma? Thank you.",
        },
      ],
    },
  ],
  events: [
    {
      id: "sports",
      title: "Inter-house sports day",
      day: 16,
      month: "OCT",
      time: "08:30 – 13:00",
      location: "School sports field",
      category: "Sport",
      audience: "Whole school",
    },
    {
      id: "reading",
      title: "Grade 1 reading morning",
      day: 21,
      month: "OCT",
      time: "07:30 – 08:15",
      location: "Grade 1 classrooms",
      category: "Academic",
      audience: "Grade 1",
    },
    {
      id: "trip",
      title: "Grade 4 botanical gardens excursion",
      day: 23,
      month: "OCT",
      time: "08:00 – 14:00",
      location: "Johannesburg Botanical Gardens",
      category: "Events",
      audience: "Grade 4",
    },
    {
      id: "meeting",
      title: "Parent–teacher afternoon",
      day: 29,
      month: "OCT",
      time: "14:00 – 17:00",
      location: "School classrooms",
      category: "General",
      audience: "Whole school",
    },
  ],
  attendance: {
    "Emma Williams": true,
    "Liam Dlamini": true,
    "Ava Naidoo": false,
    "Oliver Smith": true,
    "Mia van der Merwe": true,
  },
  conduct: [
    { title: "Wonderful teamwork in the science project", type: "Merit", child: "Emma Williams" },
  ],
  resources: [
    { title: "Term 4 school newsletter", category: "Newsletters", size: "1.2 MB" },
    { title: "2026 school calendar", category: "School documents", size: "248 KB" },
    { title: "Grade 4 excursion information", category: "Academic", size: "560 KB" },
    { title: "School code of conduct", category: "School documents", size: "420 KB" },
  ],
  invited: [],
};
export function createMockRepository(): SchoolRepository {
  // Fixtures contain only JSON-compatible data. This also works on Hermes,
  // where structuredClone is not available in every React Native version.
  let state: SchoolState = JSON.parse(JSON.stringify(initialState)) as SchoolState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    update: (fn) => {
      state = fn(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
export function visibleNotices(state: SchoolState, role: Role, child: string): Notice[] {
  return state.notices.filter(
    (n) =>
      role !== "Parent" ||
      (n.status === "Published" &&
        (n.audience === "Whole school" ||
          child === "all" ||
          n.audience === children.find((c) => c.id === child)?.grade)),
  );
}
export const money = (amount: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(amount);
