import type { IconName } from "@/components/ui/Icon";
import type { SessionUser } from "@/lib/auth/types";
import type { Messages } from "@/lib/i18n/messages/en";

type NavText = Messages["nav"];

export type NavItem = { href: string; label: string; icon?: IconName };

export type NavModel = {
  /** ~5 top-level links shown in the desktop bar. */
  primary: NavItem[];
  /** Everything else, behind «المزيد». */
  more: NavItem[];
  /** Personal links inside the account menu. */
  account: NavItem[];
};

function studentLearning(t: NavText): NavItem[] {
  return [
    { href: "/lessons", label: t.lessons, icon: "book" },
    { href: "/math-solver", label: t.solver, icon: "camera" },
    { href: "/live", label: t.live, icon: "video" },
    { href: "/exams", label: t.exams, icon: "exam" },
  ];
}

function extraLearning(t: NavText): NavItem[] {
  return [
    { href: "/lessons/interactive", label: t.whiteboard },
    { href: "/practice", label: t.practice },
    { href: "/classroom", label: t.classroom },
  ];
}

export function navFor(user: SessionUser | null, t: NavText): NavModel {
  const learning = studentLearning(t);
  const extra = extraLearning(t);
  if (!user) {
    return {
      primary: [{ href: "/", label: t.home, icon: "home" }, ...learning.slice(0, 3), { href: "/subscribe", label: t.subscribe }],
      more: [{ href: "/exams", label: t.exams }, ...extra],
      account: [],
    };
  }
  if (user.role === "teacher") {
    return {
      primary: [
        { href: "/dashboard", label: t.teacherDashboard, icon: "home" },
        { href: "/admin", label: t.admin },
        { href: "/professor", label: t.professor },
        { href: "/lessons", label: t.lessons, icon: "book" },
        { href: "/math-solver", label: t.solverShort, icon: "camera" },
      ],
      more: [
        { href: "/admin/team", label: t.teamChat },
        { href: "/admin/agent-hub", label: t.agent },
        { href: "/assistant", label: t.aiEmployee },
        { href: "/bank", label: t.teacherBank },
        { href: "/admin/b2b-manager", label: t.partnerships },
        { href: "/admin/exams", label: t.examGrading },
        { href: "/studio/script", label: t.scriptGenerator },
        { href: "/studio/voice-solver", label: t.voiceExplainer },
        { href: "/admin/video-generator", label: t.videoGenerator },
        { href: "/live", label: t.live },
        { href: "/exams", label: t.exams },
        ...extra,
      ],
      account: [
        { href: "/profile", label: t.profile, icon: "user" },
        { href: "/settings", label: t.settings, icon: "settings" },
      ],
    };
  }
  const dashboardLabel = user.role === "parent" ? t.parentDashboard : t.dashboard;
  return {
    primary: [{ href: "/dashboard", label: dashboardLabel, icon: "home" }, ...learning],
    more: [
      ...extra,
      ...(user.role === "student"
        ? [
            { href: "/resources", label: t.resources },
            { href: "/leaderboard", label: t.leaderboard },
            { href: "/student", label: t.lessonChat },
          ]
        : []),
    ],
    account: [
      { href: "/profile", label: t.profile, icon: "user" },
      { href: "/wallet", label: t.wallet, icon: "wallet" },
      { href: "/settings", label: t.settings, icon: "settings" },
      ...(user.role === "student" ? [{ href: "/redeem", label: t.redeem }] : []),
    ],
  };
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile bottom bar: 5 slots with the central «حلّ مسألة» / "Solve" orb. */
export function tabsFor(user: SessionUser | null, t: NavText): NavItem[] {
  return [
    { href: user ? "/dashboard" : "/", label: t.tabHome, icon: "home" },
    { href: "/lessons", label: t.tabLessons, icon: "book" },
    { href: "/math-solver", label: t.tabSolve, icon: "camera" },
    { href: "/live", label: t.tabLive, icon: "video" },
    { href: user ? "/profile" : "/login", label: user ? t.tabAccount : t.tabLogin, icon: "user" },
  ];
}
