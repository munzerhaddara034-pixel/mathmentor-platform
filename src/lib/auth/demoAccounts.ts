import type { AuthRole } from "./paths";
import type { SubscriptionType } from "./tiers";

/** Plaintext demo logins for local / Netlify QA. Hashes are computed when the auth store is seeded. */
export const DEMO_ACCOUNTS: Array<{
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  role: AuthRole;
  entitlementPlanId?: string;
  subscriptionType?: SubscriptionType;
  liveCredits?: number;
}> = [
  {
    id: "user-demo-student",
    email: "student@mathmentor.local",
    password: "demo-student",
    name: "Sara Nassar",
    phone: "76111111",
    role: "student",
    entitlementPlanId: "both",
    subscriptionType: "BOTH",
    liveCredits: 4,
  },
  {
    id: "user-demo-pending",
    email: "pending@mathmentor.local",
    password: "demo-pending",
    name: "Karim Fares",
    phone: "76222222",
    role: "student",
  },
  {
    id: "user-demo-parent",
    email: "parent@mathmentor.local",
    password: "demo-parent",
    name: "Rania Fares",
    phone: "76333333",
    role: "parent",
    entitlementPlanId: "all",
    subscriptionType: "AI_TIER",
    liveCredits: 0,
  },
  {
    id: "user-demo-ai",
    email: "ai@mathmentor.local",
    password: "demo-ai",
    name: "Nour Khalil",
    phone: "76444444",
    role: "student",
    entitlementPlanId: "ai",
    subscriptionType: "AI_TIER",
    liveCredits: 0,
  },
  {
    id: "user-demo-live",
    email: "live@mathmentor.local",
    password: "demo-live",
    name: "Hassan Mansour",
    phone: "76666666",
    role: "student",
    entitlementPlanId: "live",
    subscriptionType: "LIVE_TIER",
    liveCredits: 4,
  },
  {
    id: "user-demo-teacher",
    email: "teacher@mathmentor.local",
    password: "demo-teacher",
    name: "Prof. Munzer Haddara",
    phone: "76532421",
    role: "teacher",
    subscriptionType: "BOTH",
    liveCredits: 99,
  },
  {
    id: "user-demo-admin",
    email: "admin@mathmentor.local",
    password: "demo-admin",
    name: "Academy Admin",
    phone: "76532421",
    role: "admin",
    subscriptionType: "BOTH",
    liveCredits: 99,
  },
];
