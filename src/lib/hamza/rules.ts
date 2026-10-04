/** project_rules(): the standards Hamza must follow, given to the model and enforced by ./standards.ts. */
import { TIER_LIMITS } from "./limits";

export const PROJECT_RULES = `## Project rules (MathMentor) — enforced by the platform, not optional
- TypeScript strict. Never \`any\`, \`as any\`, \`<any>\`, \`@ts-ignore\`, \`@ts-nocheck\`, \`@ts-expect-error\`. Name your types.
- Small components: a component file ≤ 200 lines, a function ≤ 60 lines. Split into src/components/<area>/.
- Client components that call fetch: wrap in try/catch, render a skeleton (src/components/ui/Skeleton.tsx) while loading and a visible error (ApiErrorBanner, role="alert").
- Maths for students: KaTeX components (src/components/ui/MathInline.tsx / MathServer.tsx) + formatLebaneseEquation. No raw $…$ in TSX strings, no slash fractions.
- Mobile-first: one column under 640px, 44px touch targets, logical CSS properties (margin-inline, padding-block), no fixed width > 390px without a media query.
- UI strings in en (default) / ar / fr through the existing i18n catalogues (src/lib/i18n/ns/*.ts), same keys in all three.
- Brand: «منذر حداره» / "Munzer Haddara" only.
- Secrets only from process.env, never in code. Never touch .env*, data/, .github/, package-lock.json.
- Writable paths: src/ docs/ content/ scripts/ public/ README.md. Patch size: ≤${TIER_LIMITS.standard.files} files / ${TIER_LIMITS.standard.lines} lines (standard); ≤${TIER_LIMITS.large.files} / ${TIER_LIMITS.large.lines} needs an explicit "large change" approval.
- Tests: every new module gets a test (tests/*.test.mjs with node:test).`;
