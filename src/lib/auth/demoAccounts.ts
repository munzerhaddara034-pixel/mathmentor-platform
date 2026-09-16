import type { AuthRole } from "./paths";

/** Plaintext demo logins for local / Netlify QA. Hashes are computed when the auth store is seeded. */
export const DEMO_ACCOUNTS: Array<{
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  role: AuthRole;
  entitlementPlanId?: string;
}> = [
  {
    id: "user-demo-student",
    email: "student@mathmentor.local",
    password: "demo-student",
    name: "Sara Nassar",
    phone: "76111111",
    role: "student",
    entitlementPlanId: "all",
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
  },
  {
    id: "user-demo-teacher",
    email: "teacher@mathmentor.local",
    password: "demo-teacher",
    name: "Prof. Munzer Haddara",
    phone: "76532421",
    role: "teacher",
  },
  {
    id: "user-demo-admin",
    email: "admin@mathmentor.local",
    password: "demo-admin",
    name: "Academy Admin",
    phone: "76532421",
    role: "admin",
  },
];
