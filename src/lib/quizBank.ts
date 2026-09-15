import { academyLessons } from "./academyLessons";
import type { Difficulty, QuizQuestion } from "./types";

function q(
  lessonId: string,
  n: number,
  difficulty: Difficulty,
  prompt: string,
  options: string[],
  correctIndex: number,
  steps: string[],
  latex?: string,
  kind: QuizQuestion["kind"] = "mcq",
): QuizQuestion {
  return { id: `${lessonId}-q${n}`, lessonId, difficulty, kind, prompt, options, correctIndex, steps, latex };
}

const extra: QuizQuestion[] = [
  q("grade-12-ch1", 1, 1, "What does a limit describe?", ["The exact value f(a) always", "The value f approaches as x approaches a", "The derivative at a", "The area under the curve"], 1, ["A limit is about approach, not necessarily the value attained.", "We write $\\lim_{x\\to a} f(x)=L$."], "\\lim_{x\\to a} f(x)=L"),
  q("grade-12-ch1", 2, 2, "Compute the limit after simplification.", ["2", "3", "4", "undefined"], 2, ["Plug in x=2 first: 0/0, indeterminate.", "Factor: $x^2-4=(x-2)(x+2)$.", "Cancel $x-2$ for $x\\neq 2$: $x+2$.", "As $x\\to 2$, the value is 4."], "\\lim_{x\\to 2}\\frac{x^2-4}{x-2}"),
  q("grade-12-ch1", 3, 3, "f is continuous at a if:", ["f(a) exists only", "the limit exists only", "f(a) exists, the limit exists, and they are equal", "f is a polynomial"], 2, ["Need three conditions together.", "$f(a)$ exists, $\\lim f$ exists, and they match."]),
  q("grade-12-ch1", 4, 1, "Is $\\lim_{x\\to 0} x = 0$?", ["صح", "خطأ"], 0, ["The function approaches 0.", "The limit equals the value at 0 here."], undefined, "tf"),
  q("grade-9-ch3", 1, 1, "The unique solution of x+y=5 and x-y=1 is:", ["(2,3)", "(3,2)", "(4,1)", "(1,4)"], 1, ["Add the equations: $2x=6$ so $x=3$.", "Then $3+y=5$ so $y=2$."]),
  q("grade-9-ch5", 1, 2, "Slope of f(x)=-x+3 is:", ["3", "1", "0", "-1"], 3, ["In $f(x)=ax+b$, $a$ is the slope.", "Here $a=-1$."], "f(x)=-x+3"),
  q("grade-7-ch4", 1, 1, "Solve x+5=12.", ["5", "7", "17", "12"], 1, ["Subtract 5 from both sides.", "$x=7$. Check: $7+5=12$."]),
  q("sat-ch1", 1, 2, "If 3x+5=20, then x=", ["3", "5", "7", "15"], 1, ["Subtract 5: $3x=15$.", "Divide by 3: $x=5$."]),
];

export function questionsForLesson(lessonId: string, custom: QuizQuestion[] = []): QuizQuestion[] {
  const lesson = academyLessons.find((item) => item.id === lessonId);
  const generated: QuizQuestion[] = lesson
    ? [
        q(lessonId, 10, 1, `What is the main idea of “${lesson.title}”?`, [lesson.idea, "Skip the check", "Memorize only the title", "Guess the answer"], 0, ["The definition is the start of the method.", lesson.idea]),
        q(lessonId, 11, 2, lesson.example, [lesson.exampleBoard, "No solution", "0", "∞"], 0, ["Write the given.", `Use: ${lesson.board}`, `Result: ${lesson.exampleBoard}`]),
        q(lessonId, 12, 3, "A professional solution must include:", ["The answer only", "Given, rule, steps, and a check", "A screenshot", "A guess"], 1, ["Four lines: given, rule, steps, check.", "This is how certificate questions are marked."]),
        q(lessonId, 13, 4, `Advanced check for ${lesson.title}`, ["Always skip the verification", "The method plus a numerical check", "Memorize only", "Guess"], 1, ["Hard questions still need a check.", lesson.exampleBoard]),
      ]
    : [];
  const fromExtra = extra.filter((item) => item.lessonId === lessonId);
  const fromCustom = custom.filter((item) => item.lessonId === lessonId);
  return [...fromCustom, ...fromExtra, ...generated];
}

export function nextAdaptiveQuestion(
  lessonId: string,
  used: string[],
  lastCorrect?: boolean,
  difficulty: Difficulty = 2,
  custom: QuizQuestion[] = [],
) {
  const pool = questionsForLesson(lessonId, custom);
  let level: Difficulty = difficulty;
  if (lastCorrect === true && level < 4) level = (level + 1) as Difficulty;
  if (lastCorrect === false && level > 1) level = (level - 1) as Difficulty;
  const unused = pool.filter((item) => !used.includes(item.id));
  return unused.find((item) => item.difficulty === level) ?? unused[0] ?? null;
}

export const difficultyLabel: Record<Difficulty, string> = {
  1: "سهل",
  2: "متوسط",
  3: "صعب",
  4: "متقدم",
};
