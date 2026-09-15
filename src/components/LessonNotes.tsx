"use client";

import { useEffect } from "react";
import { MathTex } from "@/components/MathTex";
import type { NoteBlock } from "@/lib/lessonNotes";

export function LessonNotes({ blocks, dir = "ltr" }: { blocks: NoteBlock[]; dir?: "ltr" | "rtl" }) {
  useEffect(() => {
    void window.MathJax?.typesetPromise?.();
  }, [blocks]);

  return (
    <article className="lesson-notes" dir={dir}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "h2") return <h2 key={key}>{block.text}</h2>;
        if (block.type === "h3") return <h3 key={key}>{block.text}</h3>;
        if (block.type === "p") return <p key={key}>{block.text}</p>;
        if (block.type === "math") return <MathTex key={key} tex={block.tex} />;
        if (block.type === "ul") {
          return (
            <ul key={key}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "example") {
          return (
            <section key={key} className="note-example">
              <h3>{block.title}</h3>
              <p>{block.given}</p>
              <MathTex tex={block.tex} />
              <ol>
                {block.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="note-result">النتيجة: {block.result}</p>
            </section>
          );
        }
        return (
          <section key={key} className="note-mistake">
            <h3>{block.title}</h3>
            <p>
              <strong>خطأ: </strong>
              {block.wrong}
            </p>
            <p>
              <strong>الصحيح: </strong>
              {block.right}
            </p>
          </section>
        );
      })}
    </article>
  );
}
