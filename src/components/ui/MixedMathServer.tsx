import { piecesOf } from "@/lib/math/mixedMath";
import { MathServer } from "./MathServer";

/** Server twin of MixedMathText: prose with math islands rendered by server KaTeX (no client JS). */
export function MixedMathServer({ text, as: Tag = "span", className }: { text: string; as?: "span" | "p" | "h1" | "h2" | "h3"; className?: string }) {
  return (
    <Tag className={className} dir="auto">
      {piecesOf(text).map((piece, index) =>
        piece.tex ? <MathServer key={`${index}-${piece.tex}`} tex={piece.tex} display={piece.display} /> : <span key={`${index}-t`}>{piece.text}</span>,
      )}
    </Tag>
  );
}
