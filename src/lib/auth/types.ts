export const USER_ROLES = ["student", "teacher", "parent"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  linkedStudentId?: string | null;
  track?: string | null;
};

export type AuthUser = SessionUser & {
  passwordHash: string;
  createdAt: string;
};

export const DEMO_ACCOUNTS = [
  {
    role: "student" as const,
    email: "student@mathmentor.lb",
    password: "student123",
    name: "سارة حدارة",
    track: "grade-12",
  },
  {
    role: "teacher" as const,
    email: "teacher@mathmentor.lb",
    password: "teacher123",
    name: "الأستاذ منذر حدارة",
    track: null,
  },
  {
    role: "parent" as const,
    email: "parent@mathmentor.lb",
    password: "parent123",
    name: "أم سارة",
    track: null,
  },
];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function roleLabel(role: UserRole) {
  if (role === "teacher") return "أستاذ / إدارة";
  if (role === "parent") return "ولي أمر";
  return "طالب";
}
