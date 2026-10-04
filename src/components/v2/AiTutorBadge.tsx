/**
 * Visible "AI tutor" label next to every appearance of the Youssef AI-tutor persona, so students always
 * know they are talking to an AI tutor (not the human teacher). Server-safe: no hooks, label passed in.
 */
export function AiTutorBadge({ label, onDark = false }: { label: string; onDark?: boolean }) {
  return (
    <span className={`v2-ai-badge${onDark ? " on-dark" : ""}`}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M8 1.5l1.6 3.6 3.9.4-2.9 2.6.8 3.9L8 10l-3.4 2 .8-3.9L2.5 5.5l3.9-.4z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
