// Advertising offer shown on the public "Advertise with us" page and in follow-up emails.
// Pure data: edit prices, packages and wording here; no code changes needed elsewhere.

export interface AdPackage {
  name: string;
  price: string;
  period: string;
  highlights: string[];
  featured?: boolean;
}

export const ADVERTISING = {
  headline: "Put your business in front of WGJS families",
  pitch:
    "Your ad appears on the home screen of the school app that parents open every day, and as a popup when they sign in, on phones and on the web. Every rand you spend supports the school.",
  /** Optional explainer video (MP4/WebM URL or YouTube embed URL); hidden when empty. */
  videoUrl: "",
  packages: [
    {
      name: "Term spotlight",
      price: "R1 500",
      period: "per school term",
      highlights: [
        "Home-screen banner for the whole term",
        "Picture or short video",
        "Monthly views and clicks report",
      ],
    },
    {
      name: "Founding partner",
      price: "R4 000",
      period: "per year",
      highlights: [
        "Home-screen banner all year",
        "Popup at sign-in once a term",
        '"Proudly supports WGJS" badge',
        "Rate locked for the first 10 businesses",
      ],
      featured: true,
    },
    {
      name: "Event sponsor",
      price: "R750",
      period: "per event",
      highlights: ["Popup at sign-in for the event week", "Mention in the school notice"],
    },
  ] satisfies AdPackage[],
  incentives: [
    "Parent-owned businesses get 10% off any package.",
    "Refer another business and get a free month when they sign up.",
  ],
  /** Shown next to the enquiry form's consent boxes and stored with each enquiry. */
  consentEmail:
    "Yes, email me about advertising with the school (a few emails, unsubscribe at any time).",
  consentWhatsApp: "You may also contact me on WhatsApp about advertising.",
} as const;

export const ADVERTISER_CATEGORIES = [
  "Food & drink",
  "Education & tutoring",
  "Sport & activities",
  "Health & beauty",
  "Home & services",
  "Retail",
  "Property & finance",
  "Other",
] as const;
