/**
 * Legal pages content (privacy policy, terms of use) in every supported locale.
 *
 * Written against what the platform actually stores and which processors it actually calls, so the
 * text matches the product: see src/lib/auth/store.ts (account fields), src/lib/payments/types.ts
 * (payment records), src/lib/whatsapp/store.ts (WhatsApp outbox), src/lib/solver/guestTrial.ts
 * (hashed guest counter) and the outbound providers in src/lib (Gemini, OpenAI, Meta/Twilio/UltraMsg,
 * Resend, LiveKit, Zoom, HeyGen, Render).
 *
 * Owner: review the marked business choices (refund window, retention periods, governing courts)
 * before publishing, and keep CONTACT up to date.
 */
import type { Locale } from "@/lib/i18n/config";
import { WHATSAPP_COMMANDS_NUMBER } from "@/lib/team/constants";

/** Contact channels shown on both pages. WhatsApp is monitored daily; the e-mail reaches the owner. */
export const LEGAL_CONTACT = {
  whatsapp: WHATSAPP_COMMANDS_NUMBER,
  whatsappDisplay: "+961 76 532 421",
  email: "munzerhaddara2@gmail.com",
  phoneDisplay: "+961 70 772 968",
  /** Trading name used in the documents. */
  entity: { ar: "الأستاذ منذر حداره — منصة MathMentor", en: "Prof. Munzer Haddara — MathMentor", fr: "Prof. Munzer Haddara — MathMentor" },
  place: { ar: "لبنان", en: "Lebanon", fr: "Liban" },
};

export type LegalSection = { id: string; heading: string; body?: string[]; bullets?: string[] };
export type LegalDoc = { title: string; lead: string; updated: string; sections: LegalSection[] };

const UPDATED: Record<Locale, string> = {
  ar: "٦ أكتوبر ٢٠٢٦",
  en: "6 October 2026",
  fr: "6 octobre 2026",
};

/* ------------------------------------------------------------------ privacy */

export const PRIVACY: Record<Locale, LegalDoc> = {
  ar: {
    title: "سياسة الخصوصية",
    lead: "توضّح هذه السياسة ما تجمعه منصة MathMentor من بيانات، ولماذا، ومع مَن نشاركها، وكيف تحميها. اكتب إلينا في أي وقت لطلب الوصول إلى بياناتك أو حذفها.",
    updated: UPDATED.ar,
    sections: [
      {
        id: "who",
        heading: "١. من نحن ونطاق هذه السياسة",
        body: [
          "منصة MathMentor يشغّلها الأستاذ منذر حداره في لبنان (يُشار إليها بـ«المنصة» أو «نحن»). تنطبق هذه السياسة على الموقع، ووكيل واتساب، والدروس والسبورة التفاعلية، والحصص المباشرة، والحلّال الذكي.",
          "باستخدامك المنصة أو إنشاء حساب فيها، فإنك تقرّ بأنك قرأت هذه السياسة. وإذا كنت دون سنّ الرشد، تُقرأ هذه السياسة مع ولي أمرك.",
        ],
      },
      {
        id: "collect",
        heading: "٢. البيانات التي نجمعها",
        bullets: [
          "بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف (اختياري)، صفتك في المنصة (طالب أو ولي أمر). كلمة المرور تُخزَّن مشفّرة (تجزئة) ولا يمكن لأي أحد — بمن فيهم نحن — قراءتها.",
          "بيانات التعلّم: نص المسألة التي ترسلها، وصورها إن رفعتها، والشرح والحل الناتج، وتقدّمك في الدروس، ونتائج التدريب والامتحانات، ونقاط التفاعل والشارات.",
          "الحصص المباشرة: موعد الحجز والباقة والرصيد المستخدم، ومحتوى السبورة (خطوط ومعادلات) لحفظ حالة الدرس بين المشاركين. لا نسجّل الصوت أو الصورة في الحصص المباشرة.",
          "المدفوعات: اسم الدافع، وسيلة الدفع (Whish أو غيرها)، المبلغ والمرجع وتاريخ التحويل، وصورة الإيصال عند إرسالها. لا نطلب بيانات بطاقتك المصرفية ولا نخزّنها.",
          "محادثات واتساب: الرسائل والوسائط التي تتبادلها مع وكيل المنصة، والردود التي نرسلها إليك.",
          "بيانات تقنية: عنوان الإنترنت (IP) لأغراض الحماية ومنع إساءة الاستخدام، ونوع الجهاز والمتصفح، وسجلات الأخطاء. لحصة التجربة المجانية نخزّن بصمة مشتقّة من العنوان لا العنوان نفسه.",
        ],
      },
      {
        id: "why",
        heading: "٣. كيف نستخدم بياناتك",
        bullets: [
          "تقديم الخدمة: إنشاء حسابك، وحلّ مسائلك، وشرحها، وعرض تقدّمك، وإدارة حصصك.",
          "الفوترة والاشتراكات: تأكيد مدفوعاتك، وتفعيل باقتك، وتذكيرك قبل انتهائها.",
          "التواصل: ردود الدعم، وتنبيهات المنصة، ورسائل واتساب أو البريد المرتبطة بحسابك. ويمكنك إيقاف الرسائل التسويقية في أي وقت.",
          "الأمان: حماية الحسابات، ومنع مشاركة الحساب أو إساءة الاستخدام، ومنع الاختراق أو التلاعب بالمدفوعات.",
          "التطوير: فهم أي ميزة تُستخدم فعلاً وأين يتعثّر الطلاب، لتحسين المنصة. نستخدم في ذلك بيانات مجمّعة أو مجهّلة حيث يمكن.",
        ],
      },
      {
        id: "basis",
        heading: "٤. أساس المعالجة",
        body: [
          "نعالج بياناتك لتنفيذ العقد المبرم معك (تقديم الخدمة والفوترة)، ولمصلحتنا المشروعة في تأمين المنصة ومنع إساءة الاستخدام وتطويرها، وبموافقتك حين نرسل رسائل تسويقية أو حين يوافق ولي الأمر على حساب قاصر. ويمكنك سحب الموافقة في أي وقت.",
        ],
      },
      {
        id: "sharing",
        heading: "٥. مع مَن نشارك البيانات",
        body: [
          "لا نبيع بياناتك ولا نؤجّرها ولا نشاركها مع معلنين. نشاركها فقط مع مزوّدي الخدمة الذين تحتاجهم المنصة للعمل، وبالحد اللازم لتقديم الخدمة:",
        ],
        bullets: [
          "مزوّدو الذكاء الاصطناعي (Google Gemini وOpenAI): يُرسل نص المسألة أو صورتها للحصول على الحل والشرح.",
          "واتساب (Meta / Twilio / UltraMsg): لتوصيل الرسائل والوسائط بينك وبين الوكيل.",
          "البريد الإلكتروني (Resend): لإرسال رسائل التأكيد والتنبيهات.",
          "الحصص المباشرة (LiveKit، وZoom لإنشاء رابط الحصة): لإدارة الصفوف المباشرة.",
          "فيديو الشرح (HeyGen): لإنشاء مقاطع الشرح القصيرة عند توفرها.",
          "الاستضافة والتخزين (Render، وقاعدة بيانات PostgreSQL، وخدمة تخزين الملفات): لتشغيل المنصة وحفظ البيانات.",
          "خدمات مضمّنة داخل الصفحات (Desmos، GeoGebra، مشغّلات الفيديو): قد تتعرّف على جهازك وفق سياساتها الخاصة عند استخدامها.",
          "الجهات القانونية: إذا ألزمنا القانون أو أمر قضائي بذلك، أو لحماية حقوقنا وأمن مستخدمينا.",
        ],
      },
      {
        id: "cookies",
        heading: "٦. ملفات تعريف الارتباط",
        body: [
          "نستخدم ملفات ارتباط ضرورية لعمل المنصة فقط: جلسة الدخول، ولغتك المختارة، ومظهرك (فاتح أو داكن)، وتذكرة دخول الضيف إلى الصف. لا نستخدم ملفات إعلانية ولا نتبّعك خارج المنصة، ويمكنك حذفها من متصفحك في أي وقت (سيؤدي ذلك إلى تسجيل خروجك).",
        ],
      },
      {
        id: "retention",
        heading: "٧. مدة الاحتفاظ والحذف",
        bullets: [
          "بيانات الحساب والتعلّم: تبقى ما دام حسابك قائماً. وعند إغلاقه نحذفها أو نجعلها مجهولة الهوية خلال ٣٠ يوماً، عدا ما يلزمنا الاحتفاظ به قانوناً.",
          "سجلات المدفوعات والإيصالات: نحتفظ بها للمحاسبة ومنع التلاعب للمدة التي يفرضها القانون (عادةً حتى ٥ سنوات)، ويمكن حذف صورة الإيصال بعد اعتماد الدفع.",
          "محادثات واتساب: نحتفظ بآخر ٥٠٠ رسالة فقط لأغراض الدعم، ثم تُحذف تلقائياً.",
          "الجلسات: تنتهي صلاحية الجلسة تلقائياً بعد ٩٠ يوماً على الأكثر، أو فوراً عند تسجيل الخروج أو الدخول من جهاز آخر من النوع نفسه.",
          "بصمة حصة التجربة المجانية: تُحذف مع تغيّر اليوم.",
        ],
      },
      {
        id: "security",
        heading: "٨. كيف نحمي بياناتك",
        body: [
          "نخزّن كلمات المرور مجزّأة، ونقيّد محاولات الدخول المتكرّرة، ونفصل الصلاحيات بين الطالب والأستاذ والإدارة، ونستخدم اتصالاً مشفّراً (HTTPS)، ونسجّل العمليات الحساسة. ومع ذلك لا يمكن لأي نظام أن يضمن أماناً مطلقاً؛ لذا احتفظ بكلمة مرورك سرّاً ولا تشارك حسابك مع غيرك.",
        ],
      },
      {
        id: "children",
        heading: "٩. الطلاب دون سنّ الرشد",
        body: [
          "كثير من طلابنا دون الثامنة عشرة. يُنشئ الحساب الطالب أو ولي أمره، ويُفترض أن يكون إنشاء حساب القاصر بموافقة ولي الأمر. يمكن لولي الأمر في أي وقت أن يطلب الاطلاع على بيانات ابنه أو حذف الحساب، وسنستجيب خلال مدة معقولة بعد التحقق من الصلة.",
        ],
      },
      {
        id: "rights",
        heading: "١٠. حقوقك",
        bullets: [
          "الاطلاع على بياناتك التي نحتفظ بها والحصول على نسخة منها.",
          "تصحيح أي بيانات غير دقيقة.",
          "حذف حسابك وبياناتك، مع مراعاة ما يلزمنا الاحتفاظ به قانوناً.",
          "الاعتراض على معالجة معيّنة أو سحب موافقتك على الرسائل التسويقية.",
          "تقديم شكوى إلينا أولاً، ولك أن تتوجّه إلى الجهة المختصة في بلدك.",
        ],
        body: [
          "لممارسة أي من هذه الحقوق، راسلنا على قنوات التواصل في آخر هذه الصفحة. نرد عادةً خلال ٧ أيام عمل، وقد نطلب ما يثبت هويتك لحماية حسابك.",
        ],
      },
      {
        id: "transfers",
        heading: "١١. نقل البيانات خارج لبنان",
        body: [
          "مزوّدو الخدمة المذكورون أعلاه يخزّنون البيانات في مراكز بيانات خارج لبنان (الاتحاد الأوروبي والولايات المتحدة وغيرها). نختار مزوّدين موثوقين ونقتصر على ما تحتاجه الخدمة، ونلتزم بحماية بياناتك أينما عُولجت.",
        ],
      },
      {
        id: "changes",
        heading: "١٢. تعديلات هذه السياسة",
        body: [
          "قد نحدّث هذه السياسة عند تغيّر الخدمة أو القانون، وسننشر النسخة الجديدة على هذه الصفحة مع تاريخ التحديث، وننبّهك في المنصة إذا كان التغيير جوهرياً.",
        ],
      },
      {
        id: "contact",
        heading: "١٣. التواصل معنا",
        body: [
          "لأي سؤال أو طلب يخصّ الخصوصية والبيانات، تواصل معنا على واتساب أو البريد أدناه. نلتزم بالرد على طلبات البيانات خلال ٧ أيام عمل.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    lead: "This policy explains what data the MathMentor platform collects, why, who we share it with, and how we protect it. You can write to us at any time to access or delete your data.",
    updated: UPDATED.en,
    sections: [
      {
        id: "who",
        heading: "1. Who we are and what this policy covers",
        body: [
          "MathMentor is operated by Prof. Munzer Haddara in Lebanon (“the platform”, “we”). This policy covers the website, the WhatsApp agent, lessons and the interactive whiteboard, live sessions and the AI solver.",
          "By using the platform or creating an account you confirm that you have read this policy. If you are under the age of majority, this policy is read together with your parent or guardian.",
        ],
      },
      {
        id: "collect",
        heading: "2. What we collect",
        bullets: [
          "Account data: name, e-mail address, phone number (optional) and your role (student or parent). Passwords are stored hashed and cannot be read by anyone, including us.",
          "Learning data: the problem text you send, its photo if you upload one, the generated solution and explanation, your lesson progress, practice and exam results, and engagement points and badges.",
          "Live sessions: booking time, plan and credits used, and whiteboard content (strokes and equations) so the board state survives between participants. Audio and video are not recorded.",
          "Payments: payer name, payment method (Whish or another transfer), amount, reference and transfer date, and the receipt image when you send one. We never ask for or store your card details.",
          "WhatsApp conversations: the messages and media you exchange with the platform agent, and the replies we send you.",
          "Technical data: IP address for security and abuse prevention, device and browser type, and error logs. For the free guest trial we store a derived fingerprint of the address, not the address itself.",
        ],
      },
      {
        id: "why",
        heading: "3. How we use your data",
        bullets: [
          "Providing the service: creating your account, solving and explaining your problems, showing your progress and managing your sessions.",
          "Billing and subscriptions: confirming your payments, activating your plan and reminding you before it ends.",
          "Communication: support replies, platform notifications and WhatsApp or e-mail messages about your account. You can stop marketing messages at any time.",
          "Security: protecting accounts, preventing account sharing and abuse, and blocking intrusion or payment fraud.",
          "Improvement: understanding which features are actually used and where students get stuck. We use aggregated or anonymised data wherever possible.",
        ],
      },
      {
        id: "basis",
        heading: "4. Why we are allowed to process it",
        body: [
          "We process your data to perform our contract with you (service and billing), for our legitimate interest in securing, protecting and improving the platform, and with your consent where we send marketing messages or where a guardian consents for a minor's account. You may withdraw consent at any time.",
        ],
      },
      {
        id: "sharing",
        heading: "5. Who we share it with",
        body: [
          "We never sell, rent or share your data with advertisers. We share it only with the service providers the platform needs to work, and only as far as the service requires:",
        ],
        bullets: [
          "AI providers (Google Gemini and OpenAI): your problem text or photo is sent to produce the solution and explanation.",
          "WhatsApp (Meta / Twilio / UltraMsg): to deliver messages and media between you and the agent.",
          "E-mail (Resend): to send verification and notification e-mails.",
          "Live sessions (LiveKit, and Zoom to create the meeting link): to run live classes.",
          "Explanation video (HeyGen): to generate short explanation clips when available.",
          "Hosting and storage (Render, a PostgreSQL database and a file-storage service): to run the platform and keep the data.",
          "Embedded services inside pages (Desmos, GeoGebra, video players): these may recognise your device under their own policies when you use them.",
          "Legal authorities: where the law or a court order requires it, or to protect our rights and our users' safety.",
        ],
      },
      {
        id: "cookies",
        heading: "6. Cookies",
        body: [
          "We use only the cookies the platform needs to work: your login session, your chosen language, your theme (light or dark) and a guest classroom ticket. We use no advertising cookies and do not track you outside the platform. You can delete them from your browser at any time (that will sign you out).",
        ],
      },
      {
        id: "retention",
        heading: "7. How long we keep it",
        bullets: [
          "Account and learning data: kept while your account is active. When you close it we delete or anonymise it within 30 days, except what we must keep by law.",
          "Payment records and receipts: kept for accounting and anti-fraud for the period the law requires (usually up to 5 years); the receipt image can be purged once the payment is confirmed.",
          "WhatsApp conversations: only the last 500 messages are kept for support, then they are removed automatically.",
          "Sessions: expire automatically after at most 90 days, or immediately when you sign out or sign in from another device of the same type.",
          "Guest trial fingerprint: deleted when the day changes.",
        ],
      },
      {
        id: "security",
        heading: "8. How we protect your data",
        body: [
          "Passwords are hashed, repeated sign-in attempts are limited, permissions are separated between student, teacher and administration, traffic is encrypted (HTTPS) and sensitive operations are logged. No system can promise absolute security, so keep your password private and never share your account.",
        ],
      },
      {
        id: "children",
        heading: "9. Students under the age of majority",
        body: [
          "Many of our students are under 18. The account is created by the student or by a parent, and a minor's account is expected to be created with a guardian's consent. A guardian may at any time ask to see their child's data or delete the account; we respond within a reasonable period after verifying the relationship.",
        ],
      },
      {
        id: "rights",
        heading: "10. Your rights",
        bullets: [
          "See the data we hold about you and receive a copy of it.",
          "Correct any inaccurate data.",
          "Delete your account and data, subject to what we must keep by law.",
          "Object to a particular processing activity or withdraw consent to marketing messages.",
          "Complain to us first; you may also contact the competent authority in your country.",
        ],
        body: [
          "To exercise any of these rights, write to us using the channels at the end of this page. We normally reply within 7 working days and may ask for proof of identity to protect your account.",
        ],
      },
      {
        id: "transfers",
        heading: "11. Transfers outside Lebanon",
        body: [
          "The providers listed above store data in data centres outside Lebanon (European Union, United States and elsewhere). We choose reputable providers, share only what the service needs, and keep your data protected wherever it is processed.",
        ],
      },
      {
        id: "changes",
        heading: "12. Changes to this policy",
        body: [
          "We may update this policy when the service or the law changes. The new version is published on this page with its update date, and we will notify you in the platform if the change is material.",
        ],
      },
      {
        id: "contact",
        heading: "13. Contact us",
        body: [
          "For any privacy or data question, reach us on WhatsApp or by e-mail below. We commit to answering data requests within 7 working days.",
        ],
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    lead: "Cette politique explique quelles données la plateforme MathMentor collecte, pourquoi, avec qui nous les partageons et comment nous les protégeons. Vous pouvez nous écrire à tout moment pour accéder à vos données ou les supprimer.",
    updated: UPDATED.fr,
    sections: [
      {
        id: "who",
        heading: "1. Qui nous sommes et champ d’application",
        body: [
          "MathMentor est exploitée par le Prof. Munzer Haddara au Liban (« la plateforme », « nous »). Cette politique couvre le site, l’agent WhatsApp, les leçons et le tableau interactif, les cours en direct et le solveur IA.",
          "En utilisant la plateforme ou en créant un compte, vous confirmez avoir lu cette politique. Si vous êtes mineur, elle se lit avec votre parent ou tuteur.",
        ],
      },
      {
        id: "collect",
        heading: "2. Données collectées",
        bullets: [
          "Données de compte : nom, e-mail, numéro de téléphone (facultatif) et votre rôle (élève ou parent). Les mots de passe sont stockés hachés et ne peuvent être lus par personne, nous compris.",
          "Données d’apprentissage : le texte de l’exercice envoyé, sa photo le cas échéant, la solution et l’explication générées, votre progression, les résultats d’entraînement et d’examen, ainsi que les points et badges.",
          "Cours en direct : horaire, formule et crédits utilisés, et le contenu du tableau (traits et équations) pour conserver l’état du tableau. L’audio et la vidéo ne sont pas enregistrés.",
          "Paiements : nom du payeur, moyen de paiement (Whish ou autre virement), montant, référence et date du virement, et l’image du reçu si vous l’envoyez. Nous ne demandons ni ne stockons vos données de carte.",
          "Conversations WhatsApp : messages et médias échangés avec l’agent, et nos réponses.",
          "Données techniques : adresse IP pour la sécurité et la prévention des abus, type d’appareil et de navigateur, journaux d’erreurs. Pour l’essai gratuit, nous stockons une empreinte dérivée de l’adresse, pas l’adresse elle-même.",
        ],
      },
      {
        id: "why",
        heading: "3. Utilisation des données",
        bullets: [
          "Fournir le service : créer votre compte, résoudre et expliquer vos exercices, afficher votre progression et gérer vos séances.",
          "Facturation et abonnements : confirmer vos paiements, activer votre formule et vous prévenir avant son échéance.",
          "Communication : réponses du support, notifications de la plateforme et messages WhatsApp ou e-mail liés à votre compte. Vous pouvez arrêter les messages marketing à tout moment.",
          "Sécurité : protéger les comptes, empêcher le partage de compte et les abus, bloquer les intrusions et la fraude au paiement.",
          "Amélioration : comprendre quelles fonctions sont réellement utilisées et où les élèves bloquent. Nous utilisons des données agrégées ou anonymisées lorsque c’est possible.",
        ],
      },
      {
        id: "basis",
        heading: "4. Fondement du traitement",
        body: [
          "Nous traitons vos données pour exécuter notre contrat avec vous (service et facturation), par intérêt légitime pour sécuriser, protéger et améliorer la plateforme, et avec votre consentement pour les messages marketing ou pour le compte d’un mineur avec l’accord de son tuteur. Vous pouvez retirer votre consentement à tout moment.",
        ],
      },
      {
        id: "sharing",
        heading: "5. Destinataires",
        body: [
          "Nous ne vendons ni ne louons vos données et ne les partageons pas avec des annonceurs. Elles ne sont transmises qu’aux prestataires nécessaires au fonctionnement, et seulement dans la mesure requise :",
        ],
        bullets: [
          "Fournisseurs d’IA (Google Gemini et OpenAI) : le texte ou la photo de l’exercice est envoyé pour produire la solution.",
          "WhatsApp (Meta / Twilio / UltraMsg) : pour acheminer messages et médias.",
          "E-mail (Resend) : pour les messages de vérification et de notification.",
          "Cours en direct (LiveKit, et Zoom pour créer le lien) : pour animer les classes en direct.",
          "Vidéo d’explication (HeyGen) : pour générer de courtes vidéos lorsqu’elles sont disponibles.",
          "Hébergement et stockage (Render, base PostgreSQL et service de stockage de fichiers) : pour exploiter la plateforme et conserver les données.",
          "Services intégrés dans les pages (Desmos, GeoGebra, lecteurs vidéo) : ils peuvent reconnaître votre appareil selon leurs propres politiques.",
          "Autorités légales : lorsque la loi ou une décision de justice l’exige, ou pour protéger nos droits et la sécurité de nos utilisateurs.",
        ],
      },
      {
        id: "cookies",
        heading: "6. Cookies",
        body: [
          "Nous n’utilisons que les cookies nécessaires au fonctionnement : votre session de connexion, la langue choisie, le thème (clair ou sombre) et un ticket d’accès invité à la classe. Aucun cookie publicitaire, aucun suivi en dehors de la plateforme. Vous pouvez les supprimer à tout moment (cela vous déconnectera).",
        ],
      },
      {
        id: "retention",
        heading: "7. Durées de conservation",
        bullets: [
          "Données de compte et d’apprentissage : conservées tant que le compte est actif. À la fermeture, elles sont supprimées ou anonymisées sous 30 jours, sauf obligations légales.",
          "Paiements et reçus : conservés pour la comptabilité et la lutte contre la fraude pendant la durée légale (généralement jusqu’à 5 ans) ; l’image du reçu peut être purgée après validation.",
          "Conversations WhatsApp : seuls les 500 derniers messages sont conservés pour le support, puis supprimés automatiquement.",
          "Sessions : expiration automatique après 90 jours au plus, ou immédiatement à la déconnexion ou à une connexion depuis un autre appareil du même type.",
          "Empreinte de l’essai gratuit : supprimée au changement de jour.",
        ],
      },
      {
        id: "security",
        heading: "8. Protection des données",
        body: [
          "Les mots de passe sont hachés, les tentatives de connexion répétées sont limitées, les droits sont séparés entre élève, professeur et administration, le trafic est chiffré (HTTPS) et les opérations sensibles sont journalisées. Aucun système ne peut garantir une sécurité absolue : gardez votre mot de passe confidentiel et ne partagez pas votre compte.",
        ],
      },
      {
        id: "children",
        heading: "9. Élèves mineurs",
        body: [
          "Beaucoup de nos élèves ont moins de 18 ans. Le compte est créé par l’élève ou par un parent, et le compte d’un mineur est censé être créé avec l’accord de son tuteur. Un tuteur peut à tout moment demander à consulter les données de son enfant ou supprimer le compte ; nous répondons dans un délai raisonnable après vérification du lien.",
        ],
      },
      {
        id: "rights",
        heading: "10. Vos droits",
        bullets: [
          "Consulter les données que nous détenons et en obtenir une copie.",
          "Corriger toute donnée inexacte.",
          "Supprimer votre compte et vos données, sous réserve des obligations légales.",
          "Vous opposer à un traitement ou retirer votre consentement aux messages marketing.",
          "Nous saisir d’abord ; vous pouvez aussi saisir l’autorité compétente de votre pays.",
        ],
        body: [
          "Pour exercer ces droits, écrivez-nous via les canaux en fin de page. Nous répondons généralement sous 7 jours ouvrés et pouvons demander une preuve d’identité pour protéger votre compte.",
        ],
      },
      {
        id: "transfers",
        heading: "11. Transferts hors du Liban",
        body: [
          "Les prestataires cités stockent les données dans des centres de données hors du Liban (Union européenne, États-Unis et ailleurs). Nous choisissons des prestataires reconnus, ne partageons que le nécessaire et protégeons vos données partout où elles sont traitées.",
        ],
      },
      {
        id: "changes",
        heading: "12. Modifications",
        body: [
          "Nous pouvons mettre à jour cette politique si le service ou la loi évolue. La nouvelle version est publiée sur cette page avec sa date, et nous vous prévenons dans la plateforme en cas de changement important.",
        ],
      },
      {
        id: "contact",
        heading: "13. Nous contacter",
        body: [
          "Pour toute question de confidentialité ou de données, écrivez-nous sur WhatsApp ou par e-mail ci-dessous. Nous répondons aux demandes de données sous 7 jours ouvrés.",
        ],
      },
    ],
  },
};

/* -------------------------------------------------------------------- terms */

export const TERMS: Record<Locale, LegalDoc> = {
  ar: {
    title: "شروط الاستخدام",
    lead: "تحكم هذه الشروط استخدامك لمنصة MathMentor: الدروس، والحلّال الذكي، والحصص المباشرة، والاشتراكات. اقرأها قبل إنشاء حساب أو الدفع.",
    updated: UPDATED.ar,
    sections: [
      {
        id: "accept",
        heading: "١. قبول الشروط",
        body: [
          "بإنشائك حساباً أو استخدامك المنصة أو دفعك لأي اشتراك، فإنك توافق على هذه الشروط وعلى سياسة الخصوصية. وإذا كنت دون سنّ الرشد، فأنت تستخدم المنصة بموافقة ولي أمرك، وولي أمرك مسؤول عن الالتزام بهذه الشروط.",
        ],
      },
      {
        id: "account",
        heading: "٢. حسابك",
        bullets: [
          "قدّم بيانات صحيحة وحديثة، واحتفظ بكلمة مرورك سرّاً.",
          "الحساب شخصي ولا يجوز مشاركته أو بيعه أو تأجيره. نكتشف الدخول المتزامن من أجهزة متعددة من النوع نفسه ونُغلق الجلسة الأقدم تلقائياً.",
          "أنت مسؤول عن كل نشاط يجري عبر حسابك. أبلغنا فوراً إذا شككت في اختراقه.",
          "حسابات الأساتذة والإدارة تُنشأ من إدارة المنصة وحدها.",
        ],
      },
      {
        id: "subscription",
        heading: "٣. الاشتراكات والأسعار والدفع",
        bullets: [
          "الأسعار معروضة بالدولار الأميركي وتختلف حسب السوق والباقة، وتظهر لك في صفحة الاشتراك قبل الدفع.",
          "الدفع الحالي عبر تحويل Whish أو وسيلة يتفق عليها، أو عبر بطاقة تفعيل. يُفعَّل الاشتراك بعد تأكيد الدفع، وقد يستغرق التأكيد وقتاً قصيراً في ساعات العمل.",
          "مدة الاشتراك شهرياً من تاريخ التفعيل، والحصص المباشرة تُحسب كما هو موضح في باقتك.",
          "إذا غيّرنا السعر، فلن يمسّ ذلك الفترة المدفوعة سابقاً، وسنعلمك قبل التجديد.",
          "لا نطلب بيانات بطاقتك المصرفية ولا نحتفظ بها.",
        ],
      },
      {
        id: "refund",
        heading: "٤. الإلغاء والاسترداد",
        bullets: [
          "يمكنك إلغاء الاشتراك في أي وقت، ويبقى حسابك فعّالاً حتى نهاية الفترة المدفوعة، ثم يتوقف التجديد تلقائياً.",
          "طلب استرداد خلال ٧ أيام من الدفع: يُرد المبلغ كاملاً إذا لم تُستخدم الخدمة فعلياً (لم تُحلّ أكثر من مسألتين ولم تُحجز حصة مباشرة).",
          "الحصص المباشرة: تُرد قيمة الحصة إذا أُلغيت قبل ٢٤ ساعة على الأقل من موعدها، ولا تُرد بعد إتمامها أو عند التخلّف عن الحضور.",
          "بطاقة التفعيل غير المستخدمة: تُسترد خلال ١٤ يوماً من الشراء إن لم تُفعَّل.",
          "لا تُرد المبالغ في حال إغلاق الحساب بسبب مخالفة هذه الشروط (كإعادة بيع المحتوى أو مشاركة الحساب).",
        ],
      },
      {
        id: "use",
        heading: "٥. الاستخدام المسموح والممنوع",
        bullets: [
          "الاستخدام شخصي لأغراض التعلّم. ويُمنع: نسخ المحتوى أو إعادة نشره أو بيعه، أو إعادة بيع الدروس أو الحصص، أو استخراج البيانات آلياً، أو محاولة تجاوز البوابة المدفوعة أو حدّ المحاولات، أو تعطيل المنصة أو اختراقها، أو استخدامها لمحتوى مخالف للقانون.",
          "في حال المخالفة، يحق لنا تعليق الحساب أو إغلاقه، مع الاحتفاظ بحقنا في المطالبة بالتعويض عن الضرر.",
        ],
      },
      {
        id: "ip",
        heading: "٦. المحتوى والملكية الفكرية",
        body: [
          "الدروس والفيديوهات والسبورة ونصوص الامتحانات والشروح واسم المنصة وعلامتها مملوكة للأستاذ منذر حداره، ولا يجوز استخدامها خارج المنصة بلا إذن كتابي. أما المسائل التي ترسلها فتبقى لك، وتمنحنا إذناً محدوداً بمعالجتها لتقديم الخدمة (حلّها وشرحها وتحسينها). وتظهر علامة مائية باسمك على بعض المخرجات لمنع تسريب المحتوى.",
        ],
      },
      {
        id: "ai",
        heading: "٧. الحلّال الذكي وحدوده",
        bullets: [
          "الحلول والشروح تُنتَج بمساعدة الذكاء الاصطناعي وقد تحتوي أخطاء. الإجابات غير المؤكدة تُعلَّم بعبارة «بحاجة إلى مراجعة».",
          "الحلّال أداة تعلّم مساعدة وليس بديلاً عن الأستاذ ولا مرجعاً رسمياً في الامتحانات. تحقّق دائماً من الحل قبل الاعتماد عليه.",
          "لا نضمن دقة أي حل أو نتيجة امتحان أو علامة.",
          "ما ترسله (نص المسألة أو صورتها) يُعالَج لدى مزوّدي الذكاء الاصطناعي المذكورين في سياسة الخصوصية. لا ترسل بيانات شخصية أو حساسة داخل مسائل الرياضيات.",
        ],
      },
      {
        id: "live",
        heading: "٨. الحصص المباشرة",
        bullets: [
          "يُحجز الموعد عبر المنصة ويُخصم من رصيدك، ويصلك رابط الدخول.",
          "يُرجى الحضور في الموعد؛ التأخر يقلّل من مدة الحصة ولا يعوّضها.",
          "الإلغاء قبل ٢٤ ساعة يعيد الحصة إلى رصيدك، وبعدها تُحتسب الحصة.",
          "التزم بسلوك محترم في الصف. يحق لنا إنهاء الحصة أو إيقاف الحساب عند الإساءة.",
          "لا نسجّل الصوت أو الصورة، لكن قد يُحفظ محتوى السبورة (الخطوط والمعادلات) لعرضه لمن حضر الدرس.",
        ],
      },
      {
        id: "availability",
        heading: "٩. توفّر الخدمة وتغييراتها",
        body: [
          "نبذل جهداً معقولاً لإبقاء المنصة متاحة، وقد تتوقف جزئياً لأعمال صيانة أو لأسباب خارجة عن إرادتنا (انقطاع الإنترنت أو خدمات المزوّدين). وقد نضيف ميزات أو نعدّلها أو نوقف بعضها، وسنُعلمك مسبقاً إذا كان التغيير جوهرياً ويؤثر في باقتك.",
        ],
      },
      {
        id: "liability",
        heading: "١٠. إخلاء المسؤولية وحدودها",
        body: [
          "تُقدَّم المنصة «كما هي». لا نضمن نتيجة دراسية أو امتحانية معيّنة، ولا نتحمّل مسؤولية قرارات تُبنى على مخرجات الذكاء الاصطناعي دون تحقّق. وبالقدر الذي يسمح به القانون، لا تتجاوز مسؤوليتنا الإجمالية المبلغ الذي دفعته لنا في الأشهر الثلاثة السابقة للحادثة، ولا نتحمّل الأضرار غير المباشرة أو فوات المنفعة. لا يُحدّ هذا البند من أي حق لا يجوز التنازل عنه قانوناً.",
        ],
      },
      {
        id: "termination",
        heading: "١١. إنهاء الحساب",
        body: [
          "يمكنك إغلاق حسابك بمراسلتنا. ويحق لنا تعليق الحساب أو إغلاقه عند مخالفة هذه الشروط أو محاولة إساءة الاستخدام أو التلاعب بالمدفوعات. عند الإغلاق تتوقف الخدمة، ويُعمل بسياسة الاحتفاظ في سياسة الخصوصية.",
        ],
      },
      {
        id: "law",
        heading: "١٢. القانون الواجب التطبيق والتعديلات",
        body: [
          "تخضع هذه الشروط للقانون اللبناني، وتختصّ المحاكم اللبنانية بالنظر في أي نزاع، مع محاولة الحل ودياً أولاً. وقد نحدّث هذه الشروط عند تطوير الخدمة أو تغيّر القانون، وتُسري النسخة المنشورة هنا من تاريخ تحديثها، ونُعلمك في المنصة إذا كان التغيير جوهرياً. استمرارك في الاستخدام بعد التحديث يعني قبولك له.",
        ],
      },
      {
        id: "contact",
        heading: "١٣. التواصل",
        body: [
          "لأي سؤال عن هذه الشروط أو اشتراكك، تواصل معنا على واتساب أو البريد أدناه، أو من خلال صفحة الاشتراك.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Use",
    lead: "These terms govern your use of the MathMentor platform: lessons, the AI solver, live sessions and subscriptions. Please read them before creating an account or paying.",
    updated: UPDATED.en,
    sections: [
      {
        id: "accept",
        heading: "1. Accepting these terms",
        body: [
          "By creating an account, using the platform or paying for a subscription you agree to these terms and to the Privacy Policy. If you are under the age of majority you use the platform with your guardian's consent, and your guardian is responsible for complying with these terms.",
        ],
      },
      {
        id: "account",
        heading: "2. Your account",
        bullets: [
          "Give accurate, up-to-date details and keep your password private.",
          "The account is personal and may not be shared, sold or rented out. We detect simultaneous sign-ins from several devices of the same type and close the older session automatically.",
          "You are responsible for everything done through your account. Tell us immediately if you suspect it has been compromised.",
          "Teacher and admin accounts are created by the platform administration only.",
        ],
      },
      {
        id: "subscription",
        heading: "3. Subscriptions, prices and payment",
        bullets: [
          "Prices are shown in US dollars and vary by market and plan; you see yours on the subscription page before paying.",
          "Payment is currently by Whish transfer, an agreed alternative method, or an activation card. The subscription is activated once the payment is confirmed, which can take a short time during working hours.",
          "A subscription runs monthly from the activation date, and live sessions are counted as described in your plan.",
          "If we change prices, it does not affect a period you have already paid for, and we will tell you before renewal.",
          "We never ask for or store your card details.",
        ],
      },
      {
        id: "refund",
        heading: "4. Cancellation and refunds",
        bullets: [
          "You can cancel at any time; your account stays active until the end of the paid period and renewal then stops automatically.",
          "Refund request within 7 days of payment: fully refunded if the service was not really used (no more than two solved problems and no live session booked).",
          "Live sessions: refunded if cancelled at least 24 hours before the booked time; not refunded once completed or if you do not attend.",
          "An unused activation card is refundable within 14 days of purchase.",
          "No refund when an account is closed for breaching these terms (for example reselling content or sharing an account).",
        ],
      },
      {
        id: "use",
        heading: "5. Acceptable use",
        bullets: [
          "Use is personal and for learning. You may not copy or republish or sell the content, resell lessons or sessions, scrape data automatically, try to bypass the paywall or the rate limits, disrupt or break into the platform, or use it for unlawful content.",
          "If these rules are broken we may suspend or close the account, and we keep our right to claim compensation for the damage caused.",
        ],
      },
      {
        id: "ip",
        heading: "6. Content and intellectual property",
        body: [
          "The lessons, videos, whiteboard, exam papers, explanations and the platform name and brand belong to Prof. Munzer Haddara and may not be used outside the platform without written permission. The problems you send remain yours, and you give us a limited permission to process them to provide the service (solve, explain and improve). A watermark with your name appears on some outputs to prevent content leaking.",
        ],
      },
      {
        id: "ai",
        heading: "7. The AI solver and its limits",
        bullets: [
          "Solutions and explanations are produced with the help of artificial intelligence and may contain mistakes. Unconfirmed answers are marked “Needs review”.",
          "The solver is a study aid, not a replacement for the teacher and not an official exam reference. Always check a solution before relying on it.",
          "We do not guarantee the accuracy of any solution, exam result or mark.",
          "What you send (the problem text or its photo) is processed by the AI providers listed in the Privacy Policy. Do not send personal or sensitive data inside maths problems.",
        ],
      },
      {
        id: "live",
        heading: "8. Live sessions",
        bullets: [
          "The time is booked through the platform and deducted from your balance, and you receive the join link.",
          "Please attend on time; arriving late shortens the session and does not extend it.",
          "Cancelling at least 24 hours before returns the session to your balance; after that the session is counted.",
          "Behave respectfully in class. We may end a session or suspend an account for abuse.",
          "Audio and video are not recorded, but whiteboard content (strokes and equations) may be kept to show to the people who attended.",
        ],
      },
      {
        id: "availability",
        heading: "9. Availability and changes to the service",
        body: [
          "We make a reasonable effort to keep the platform available; parts may pause for maintenance or for reasons beyond our control (internet outages or provider failures). We may add, change or retire features, and we will give advance notice when a change is material and affects your plan.",
        ],
      },
      {
        id: "liability",
        heading: "10. Disclaimer and limits of liability",
        body: [
          "The platform is provided “as is”. We do not guarantee any particular study or exam outcome, and we are not responsible for decisions taken on AI output without verification. To the extent the law allows, our total liability does not exceed the amount you paid us in the three months before the event, and we are not liable for indirect losses or lost opportunity. Nothing here limits a right that cannot be waived by law.",
        ],
      },
      {
        id: "termination",
        heading: "11. Closing your account",
        body: [
          "You can close your account by writing to us. We may suspend or close an account that breaches these terms, attempts abuse or tampers with payments. When an account closes the service stops, and the retention policy in the Privacy Policy applies.",
        ],
      },
      {
        id: "law",
        heading: "12. Governing law and updates",
        body: [
          "These terms are governed by Lebanese law and the Lebanese courts have jurisdiction over any dispute, after we first try to resolve it amicably. We may update these terms as the service or the law develops; the version published here applies from its update date, we notify you in the platform when a change is material, and continuing to use the platform means you accept it.",
        ],
      },
      {
        id: "contact",
        heading: "13. Contact",
        body: [
          "For any question about these terms or your subscription, reach us on WhatsApp or by e-mail below, or through the subscription page.",
        ],
      },
    ],
  },
  fr: {
    title: "Conditions d’utilisation",
    lead: "Ces conditions régissent votre utilisation de la plateforme MathMentor : leçons, solveur IA, cours en direct et abonnements. Merci de les lire avant de créer un compte ou de payer.",
    updated: UPDATED.fr,
    sections: [
      {
        id: "accept",
        heading: "1. Acceptation",
        body: [
          "En créant un compte, en utilisant la plateforme ou en payant un abonnement, vous acceptez ces conditions et la Politique de confidentialité. Si vous êtes mineur, vous utilisez la plateforme avec l’accord de votre tuteur, qui est responsable du respect de ces conditions.",
        ],
      },
      {
        id: "account",
        heading: "2. Votre compte",
        bullets: [
          "Fournissez des informations exactes et à jour et gardez votre mot de passe confidentiel.",
          "Le compte est personnel : il ne peut être partagé, vendu ou loué. Nous détectons les connexions simultanées depuis plusieurs appareils du même type et fermons automatiquement la session la plus ancienne.",
          "Vous êtes responsable de toute activité effectuée via votre compte. Prévenez-nous immédiatement en cas de doute.",
          "Les comptes enseignant et administrateur sont créés uniquement par l’administration.",
        ],
      },
      {
        id: "subscription",
        heading: "3. Abonnements, prix et paiement",
        bullets: [
          "Les prix sont affichés en dollars américains et varient selon le marché et la formule ; le vôtre est indiqué sur la page d’abonnement avant paiement.",
          "Le paiement se fait actuellement par virement Whish, par un autre moyen convenu, ou par carte d’activation. L’abonnement est activé après confirmation du paiement, ce qui peut prendre un peu de temps pendant les heures ouvrables.",
          "L’abonnement est mensuel à partir de la date d’activation ; les cours en direct sont décomptés selon votre formule.",
          "Une hausse de prix ne s’applique pas à une période déjà payée et vous en êtes informé avant le renouvellement.",
          "Nous ne demandons ni ne stockons vos données de carte bancaire.",
        ],
      },
      {
        id: "refund",
        heading: "4. Annulation et remboursements",
        bullets: [
          "Vous pouvez annuler à tout moment ; le compte reste actif jusqu’à la fin de la période payée, puis le renouvellement s’arrête automatiquement.",
          "Demande de remboursement dans les 7 jours suivant le paiement : remboursement intégral si le service n’a pas réellement été utilisé (au plus deux exercices résolus et aucun cours réservé).",
          "Cours en direct : remboursé si annulé au moins 24 heures avant l’horaire réservé ; non remboursé une fois le cours donné ou en cas d’absence.",
          "Une carte d’activation non utilisée est remboursable dans les 14 jours suivant l’achat.",
          "Aucun remboursement lorsque le compte est fermé pour manquement à ces conditions (revente de contenu ou partage de compte par exemple).",
        ],
      },
      {
        id: "use",
        heading: "5. Utilisation autorisée",
        bullets: [
          "L’usage est personnel et destiné à l’apprentissage. Il est interdit de copier, republier ou revendre le contenu, de revendre des leçons ou des séances, d’extraire les données automatiquement, de contourner le paiement ou les limites d’usage, de perturber ou d’introduire dans la plateforme, ou d’y publier un contenu illicite.",
          "En cas de manquement, nous pouvons suspendre ou fermer le compte, et nous conservons le droit de réclamer réparation du préjudice.",
        ],
      },
      {
        id: "ip",
        heading: "6. Contenu et propriété intellectuelle",
        body: [
          "Les leçons, vidéos, tableau, sujets d’examen, explications ainsi que le nom et la marque de la plateforme appartiennent au Prof. Munzer Haddara et ne peuvent être utilisés hors de la plateforme sans autorisation écrite. Les exercices que vous envoyez restent les vôtres ; vous nous accordez une autorisation limitée de les traiter pour fournir le service (résoudre, expliquer, améliorer). Un filigrane portant votre nom apparaît sur certaines sorties pour éviter les fuites de contenu.",
        ],
      },
      {
        id: "ai",
        heading: "7. Le solveur IA et ses limites",
        bullets: [
          "Les solutions et explications sont produites avec l’aide de l’intelligence artificielle et peuvent contenir des erreurs. Les réponses non confirmées sont signalées « à vérifier ».",
          "Le solveur est une aide à l’étude, non un remplacement du professeur ni une référence officielle d’examen. Vérifiez toujours une solution avant de vous y fier.",
          "Nous ne garantissons l’exactitude d’aucune solution, d’aucun résultat d’examen ni d’aucune note.",
          "Ce que vous envoyez (texte ou photo de l’exercice) est traité par les fournisseurs d’IA cités dans la Politique de confidentialité. N’envoyez pas de données personnelles ou sensibles dans les exercices.",
        ],
      },
      {
        id: "live",
        heading: "8. Cours en direct",
        bullets: [
          "L’horaire est réservé via la plateforme et déduit de votre solde, et vous recevez le lien de connexion.",
          "Merci d’être ponctuel : un retard raccourcit la séance sans la prolonger.",
          "Une annulation au moins 24 heures à l’avance rend la séance à votre solde ; ensuite elle est décomptée.",
          "Adoptez un comportement respectueux en classe. Nous pouvons mettre fin à une séance ou suspendre un compte en cas d’abus.",
          "L’audio et la vidéo ne sont pas enregistrés, mais le contenu du tableau (traits et équations) peut être conservé pour les participants.",
        ],
      },
      {
        id: "availability",
        heading: "9. Disponibilité et évolutions",
        body: [
          "Nous faisons un effort raisonnable pour maintenir la plateforme disponible ; certaines parties peuvent être suspendues pour maintenance ou pour des raisons indépendantes de notre volonté (coupures Internet, défaillances de prestataires). Nous pouvons ajouter, modifier ou retirer des fonctions, et vous prévenons à l’avance si un changement est important pour votre formule.",
        ],
      },
      {
        id: "liability",
        heading: "10. Responsabilité",
        body: [
          "La plateforme est fournie « en l’état ». Nous ne garantissons aucun résultat scolaire ou d’examen et ne sommes pas responsables des décisions prises sans vérification sur la base des réponses de l’IA. Dans la mesure permise par la loi, notre responsabilité totale ne dépasse pas les sommes que vous nous avez versées au cours des trois mois précédant l’événement, et nous ne répondons pas des dommages indirects ni de la perte de chance. Aucune clause ne limite un droit auquel il ne peut être renoncé légalement.",
        ],
      },
      {
        id: "termination",
        heading: "11. Fermeture du compte",
        body: [
          "Vous pouvez fermer votre compte en nous écrivant. Nous pouvons suspendre ou fermer un compte qui enfreint ces conditions, tente un abus ou manipule les paiements. À la fermeture, le service s’arrête et la politique de conservation de la Politique de confidentialité s’applique.",
        ],
      },
      {
        id: "law",
        heading: "12. Droit applicable et mises à jour",
        body: [
          "Ces conditions sont régies par le droit libanais et les tribunaux libanais sont compétents pour tout litige, après une tentative de règlement amiable. Nous pouvons les mettre à jour selon l’évolution du service ou du droit ; la version publiée ici s’applique dès sa date, nous vous informons dans la plateforme en cas de changement important, et la poursuite de l’utilisation vaut acceptation.",
        ],
      },
      {
        id: "contact",
        heading: "13. Contact",
        body: [
          "Pour toute question sur ces conditions ou votre abonnement, écrivez-nous sur WhatsApp ou par e-mail ci-dessous, ou via la page d’abonnement.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS } as const;
export type LegalDocId = keyof typeof LEGAL_DOCS;

/** Titles reused by the footer, the subscribe notice and the cross-link between the two pages. */
export const LEGAL_TITLES: Record<LegalDocId, Record<Locale, string>> = {
  privacy: { ar: "سياسة الخصوصية", en: "Privacy Policy", fr: "Politique de confidentialité" },
  terms: { ar: "شروط الاستخدام", en: "Terms of Use", fr: "Conditions d’utilisation" },
};
