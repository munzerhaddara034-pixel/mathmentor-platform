/** Demo profile seed shared by the SQLite and Postgres profile repositories. */
import { createId } from "@/lib/ids";
import { hashPassword } from "./password";
import { DEMO_ACCOUNTS } from "./types";
import type { ProfileSeed } from "./profileTypes";

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function buildProfileSeed(): ProfileSeed {
  const now = new Date().toISOString();
  const ids: Record<string, string> = {};
  const users = DEMO_ACCOUNTS.map((account) => {
    const id = createId(account.role);
    ids[account.role] = id;
    return {
      id,
      email: account.email.toLowerCase(),
      name: account.name,
      password_hash: hashPassword(account.password),
      role: account.role,
      linked_student_id: null as string | null,
      track: account.track,
      created_at: now,
    };
  });
  const parent = users.find((user) => user.id === ids.parent);
  if (parent) parent.linked_student_id = ids.student ?? null;

  const student = ids.student;
  return {
    users,
    enrollments: [
      { id: createId("enr"), user_id: student, track: "grade-12", progress: 38, created_at: now },
      { id: createId("enr"), user_id: student, track: "grade-9", progress: 22, created_at: now },
    ],
    progress: [
      { id: createId("lp"), user_id: student, lesson_id: "grade-12-ch1", percent: 100, passed_quiz: 1, completed_at: now },
      { id: createId("lp"), user_id: student, lesson_id: "grade-12-ch2", percent: 70, passed_quiz: 1, completed_at: now },
      { id: createId("lp"), user_id: student, lesson_id: "grade-12-ch3", percent: 40, passed_quiz: 0, completed_at: now },
      { id: createId("lp"), user_id: student, lesson_id: "grade-9-ch4", percent: 55, passed_quiz: 0, completed_at: now },
    ],
    reminders: [
      {
        id: createId("ex"),
        user_id: student,
        track: "grade-12",
        title: "Continuity checkpoint",
        arabic_title: "اختبار الاستمرار",
        due_at: daysFromNow(4),
        href: "/quiz/grade-12-ch2",
        created_at: now,
      },
      {
        id: createId("ex"),
        user_id: student,
        track: "grade-12",
        title: "LS functions contest",
        arabic_title: "مسابقة دراسة الدوال — علوم الحياة",
        due_at: daysFromNow(10),
        href: "/practice/take?bank=g12-ls-functions&mode=contest",
        created_at: now,
      },
      {
        id: createId("ex"),
        user_id: student,
        track: "grade-9",
        title: "Thales / Brevet geometry",
        arabic_title: "طاليس · هندسة الشهادة المتوسطة",
        due_at: daysFromNow(18),
        href: "/practice/take?bank=brevet-geometry&mode=contest",
        created_at: now,
      },
    ],
  };
}
