"use client";

import { TeacherLessonPlayer } from "@/components/TeacherLessonPlayer";
import { grade12LsCh1Scenes } from "@/lib/grade12LsCh1";
import Link from "next/link";

export default function Grade12LsChapter1Page() {
  return (
    <main className="shell">
      <p className="eyebrow">Grade 12 · Life Sciences</p>
      <h1>Chapter 1 · Functions: Limits</h1>
      <p className="muted">
        Opening lesson. You see the teacher’s picture, the written English on the board and captions, and you hear the explanation in English.
      </p>
      <TeacherLessonPlayer scenes={grade12LsCh1Scenes} language="en" />
      <article className="card" style={{ marginTop: 24 }}>
        <h3>After this video</h3>
        <p className="muted">
          Continuity and the derivative come next in the same chapter. Solutions stay in the professor queue until
          approved.
        </p>
        <div className="row">
          <Link href="/student" className="btn dark">
            Student desk
          </Link>
          <Link href="/professor" className="btn">
            Professor review
          </Link>
        </div>
      </article>
    </main>
  );
}
