/**
 * Server-only seed rows for the SQLite / Postgres profile repositories (local dev + first boot).
 * Never import this file from a client component: the plaintext passwords must stay out of the
 * browser bundle and out of the public login page.
 */
import type { UserRole } from "./types";

export type ProfileSeedAccount = {
  role: UserRole;
  email: string;
  password: string;
  name: string;
  track: string | null;
};

export const PROFILE_SEED_ACCOUNTS: ProfileSeedAccount[] = [
  {
    role: "student",
    email: "student@mathmentor.lb",
    password: "student123",
    name: "سارة حداره",
    track: "grade-12",
  },
  {
    role: "teacher",
    email: "teacher@mathmentor.lb",
    password: "teacher123",
    name: "الأستاذ منذر حداره",
    track: null,
  },
  {
    role: "parent",
    email: "parent@mathmentor.lb",
    password: "parent123",
    name: "أم سارة",
    track: null,
  },
];
