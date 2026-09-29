# Engineering standards · معايير هندسة MathMentor

**Brand / العلامة:** Prof. Munzer Haddara / الأستاذ **منذر حداره** only. Never Al-Tarah / الطارة.

## EN (short)

1. **TypeScript** — No `any` in `src/app` / `src/components` you touch (live classroom, voice-math, math-solver). Prefer named types and API response interfaces.
2. **Modular** — Page files over ~400 lines must be split into components under `src/components/`.
3. **Math** — Student-visible math uses KaTeX + `formatLebaneseEquation` (`lebaneseEquationFormat`). No slash fractions (`1/x`); use `\frac{a}{b}`.
4. **API UI** — Async fetches (LiveKit token, voice-math submit, solve-math) show **Skeleton** loaders and **visible error** banners (`role="alert"`).
5. **Mobile-first** — Layouts stack on small screens (`mm-mobile-stack`, single-column grids &lt;640px); touch-friendly controls.
6. **Docs** — Keep this file + `docs/AUDIT_ANY.md` current when touching typed surfaces.
7. **Deploy** — Netlify `@netlify/plugin-nextjs`, `NODE_VERSION=22`, keep `@netlify/blobs`.

## عربية (مختصر)

1. **TypeScript** — ممنوع `any` في الملفات التي تُعدَّل تحت الصف المباشر / الصوت / الحلّال. استخدم أنواعاً صريحة.
2. **تقسيم** — أي صفحة أطول من ~400 سطر تُقسَّم إلى مكوّنات في `src/components/`.
3. **رياضيات** — KaTeX + تنسيق المنهج اللبناني؛ لا كسور بشرطة مائلة للطالب.
4. **واجهات API** — Skeleton أثناء التحميل + رسالة خطأ واضحة (LiveKit / voice-math / solve-math).
5. **موبايل أولاً** — أعمدة واحدة على الشاشات الضيقة وأزرار لمس مريحة.
6. **توثيق** — حدّث هذا الملف و`AUDIT_ANY.md`.
7. **العلامة** — **منذر حداره** فقط.

## Key paths

| Area | UI | API |
|------|----|-----|
| Live classroom | `src/components/live/*` | `/api/livekit/token` |
| Voice-to-Math | `src/components/voice/*` | `/api/voice-math` |
| Math solver | `src/components/solver/*` | `/api/solve-math` |
| Skeleton / errors | `src/components/ui/Skeleton.tsx` | — |
| Lebanese math | `src/lib/math/lebaneseEquationFormat.ts` | — |
| B2B ops | `src/components/admin/b2b/*` · `/admin/b2b-manager` | `/api/admin/b2b/*` |
