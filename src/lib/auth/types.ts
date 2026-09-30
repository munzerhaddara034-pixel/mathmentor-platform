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

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function roleLabel(role: UserRole) {
  if (role === "teacher") return "أستاذ / إدارة";
  if (role === "parent") return "ولي أمر";
  return "طالب";
}
