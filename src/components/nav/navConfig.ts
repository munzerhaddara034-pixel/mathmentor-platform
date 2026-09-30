import type { IconName } from "@/components/ui/Icon";
import type { SessionUser } from "@/lib/auth/types";

export type NavItem = { href: string; label: string; icon?: IconName };

export type NavModel = {
  /** ~5 top-level links shown in the desktop bar. */
  primary: NavItem[];
  /** Everything else, behind «المزيد». */
  more: NavItem[];
  /** Personal links inside the account menu. */
  account: NavItem[];
};

const STUDENT_LEARNING: NavItem[] = [
  { href: "/lessons", label: "الدروس", icon: "book" },
  { href: "/math-solver", label: "حلّال المسائل", icon: "camera" },
  { href: "/live", label: "الحصص المباشرة", icon: "video" },
  { href: "/exams", label: "الامتحانات", icon: "exam" },
];

const EXTRA_LEARNING: NavItem[] = [
  { href: "/lessons/interactive", label: "السبورة التفاعلية" },
  { href: "/practice", label: "بنك الأسئلة" },
  { href: "/classroom", label: "الصف" },
];

export function navFor(user: SessionUser | null): NavModel {
  if (!user) {
    return {
      primary: [{ href: "/", label: "الرئيسية", icon: "home" }, ...STUDENT_LEARNING.slice(0, 3), { href: "/subscribe", label: "الاشتراك" }],
      more: [{ href: "/exams", label: "الامتحانات" }, ...EXTRA_LEARNING],
      account: [],
    };
  }
  if (user.role === "teacher") {
    return {
      primary: [
        { href: "/dashboard", label: "لوحة التحكم", icon: "home" },
        { href: "/admin", label: "الإدارة" },
        { href: "/professor", label: "الأستاذ" },
        { href: "/lessons", label: "الدروس", icon: "book" },
        { href: "/math-solver", label: "الحلّال", icon: "camera" },
      ],
      more: [
        { href: "/admin/team", label: "دردشة الفريق" },
        { href: "/admin/agent-hub", label: "الوكيل" },
        { href: "/assistant", label: "الموظف الذكي" },
        { href: "/bank", label: "بنك الأستاذ" },
        { href: "/admin/b2b-manager", label: "الشراكات" },
        { href: "/admin/exams", label: "تصحيح الامتحانات" },
        { href: "/studio/script", label: "مولّد السكربت" },
        { href: "/studio/voice-solver", label: "الشرح الصوتي" },
        { href: "/admin/video-generator", label: "مولّد الفيديو" },
        { href: "/live", label: "الحصص المباشرة" },
        { href: "/exams", label: "الامتحانات" },
        ...EXTRA_LEARNING,
      ],
      account: [{ href: "/profile", label: "ملفي", icon: "user" }],
    };
  }
  const dashboardLabel = user.role === "parent" ? "لوحة ولي الأمر" : "لوحتي";
  return {
    primary: [{ href: "/dashboard", label: dashboardLabel, icon: "home" }, ...STUDENT_LEARNING],
    more: [
      ...EXTRA_LEARNING,
      ...(user.role === "student"
        ? [
            { href: "/resources", label: "المرفقات" },
            { href: "/leaderboard", label: "لوحة الصدارة" },
            { href: "/student", label: "دردشة الدرس" },
          ]
        : []),
    ],
    account: [
      { href: "/profile", label: "ملفي", icon: "user" },
      { href: "/wallet", label: "المحفظة", icon: "wallet" },
      ...(user.role === "student" ? [{ href: "/redeem", label: "تفعيل بطاقة" }] : []),
    ],
  };
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile bottom bar: 5 slots with the central «حلّ مسألة». */
export function tabsFor(user: SessionUser | null): NavItem[] {
  return [
    { href: user ? "/dashboard" : "/", label: "الرئيسية", icon: "home" },
    { href: "/lessons", label: "الدروس", icon: "book" },
    { href: "/math-solver", label: "حلّ مسألة", icon: "camera" },
    { href: "/live", label: "مباشر", icon: "video" },
    { href: user ? "/profile" : "/login", label: user ? "حسابي" : "دخول", icon: "user" },
  ];
}
