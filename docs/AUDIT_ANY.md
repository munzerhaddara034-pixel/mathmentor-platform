# AUDIT_ANY · TypeScript `any` audit

**Date:** 2026-09-19 (Asia/Beirut)  
**Scope:** `src/app` + `src/components` for live classroom, voice-math, math-solver (branch `cursor/livekit-classroom-4117` + eng-standards pass).

## Result

**No remaining `: any` / `as any` / `Promise<any>` / `Array<any>` / `Record<string, any>`** in:

- `src/app/live/**`
- `src/app/classroom/**`
- `src/app/studio/voice-solver/**`
- `src/app/math-solver/**`
- `src/app/lessons/voice-solver/**`
- `src/components/live/**`
- `src/components/voice/**`
- `src/components/solver/**`
- `src/components/ui/Skeleton.tsx`

Touched surfaces use named types (`ClassroomTokenPayload`, `TokenApiResponse`, `BoardApiResponse`, `SolvePayload`, `VideoPayload`, `SolveMathResponse`, `LessonLanguage`, `CertificateTrack`, `WhiteboardBoardState`).

## Repo-wide note

A full-repo scan for typed `any` under `src/` found **zero** matches at audit time. English prose containing the word “any” (e.g. “before any calculation”) is unrelated.

## Re-audit command

```bash
rg -n ': any\b|as any\b|<any>|Promise<any>|Array<any>|Record<string,\s*any>' src --glob '*.{ts,tsx}'
```

If this command prints lines, list them here and remove `any` before merge.
