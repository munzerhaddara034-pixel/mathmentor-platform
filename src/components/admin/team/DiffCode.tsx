"use client";

import { highlightLine } from "@/lib/hamza/highlight";

/** One highlighted code line (LTR, whitespace preserved). */
export function DiffCode({ text, path }: { text: string; path: string }) {
  return (
    <code className="team-diff-code">
      {highlightLine(text, path).map((token, index) =>
        token.kind === "plain" ? token.text : (
          <span key={index} className={`tok-${token.kind}`}>
            {token.text}
          </span>
        ),
      )}
      {text ? null : " "}
    </code>
  );
}
