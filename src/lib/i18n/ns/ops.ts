import type { Locale } from "../config";

/** Admin ops page: the first-party error log (labels only; the data itself is never translated). */
const en = {
  pages: {
    opsEyebrow: "Ops · MathMentor",
    opsTitle: "Platform errors",
    opsLead: "Every unhandled server error is recorded here, grouped by fingerprint and scrubbed of personal data.",
    backToAdmin: "Admin",
    opsEmpty: "No errors recorded — the platform has been answering cleanly.",
    opsTotal: "Total",
    opsLast24: "Last 24 hours",
    opsLast7: "Last 7 days",
    opsRows: "Grouped rows",
    opsSource: "Source",
    opsRoute: "Route",
    opsCount: "Count",
    opsLastSeen: "Last seen",
    opsMessage: "Message",
    opsTop: "Most frequent",
  },
};

const ar: typeof en = {
  pages: {
    opsEyebrow: "التشغيل · MathMentor",
    opsTitle: "أخطاء المنصة",
    opsLead: "كل خطأ خادم غير معالَج يُسجَّل هنا، مجمّعاً ببصمة ومنقّى من البيانات الشخصية.",
    backToAdmin: "الإدارة",
    opsEmpty: "لا أخطاء مسجّلة — المنصة تخدم بسلاسة.",
    opsTotal: "الإجمالي",
    opsLast24: "آخر ٢٤ ساعة",
    opsLast7: "آخر ٧ أيام",
    opsRows: "الصفوف المجمّعة",
    opsSource: "المصدر",
    opsRoute: "المسار",
    opsCount: "التكرار",
    opsLastSeen: "آخر ظهور",
    opsMessage: "الرسالة",
    opsTop: "الأكثر تكراراً",
  },
};

const fr: typeof en = {
  pages: {
    opsEyebrow: "Exploitation · MathMentor",
    opsTitle: "Erreurs de la plateforme",
    opsLead: "Chaque erreur serveur non traitée est enregistrée ici, regroupée par empreinte et nettoyée des données personnelles.",
    backToAdmin: "Administration",
    opsEmpty: "Aucune erreur enregistrée — la plateforme répond proprement.",
    opsTotal: "Total",
    opsLast24: "Dernières 24 heures",
    opsLast7: "7 derniers jours",
    opsRows: "Lignes regroupées",
    opsSource: "Source",
    opsRoute: "Route",
    opsCount: "Occurrences",
    opsLastSeen: "Vu le",
    opsMessage: "Message",
    opsTop: "Les plus fréquentes",
  },
};

export const opsMessages: Record<Locale, typeof en> = { en, ar, fr };