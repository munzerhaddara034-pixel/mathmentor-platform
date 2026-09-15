export function evaluateLinearEquationAnswer(answer: string) {
  const normalized = answer.trim().toLowerCase().replace(/\s+/g, "");
  const correct = normalized === "x=5" || normalized === "5";
  return {
    correct,
    feedback: correct
      ? "Correct. Subtract 5 from both sides, then divide by 3: 3x = 15, so x = 5."
      : "Not yet. Start by subtracting 5 from both sides, then divide the result by 3.",
  };
}

export function hasPremiumAccess(subscriptionStatus: "free" | "pending" | "active") {
  return subscriptionStatus === "active";
}

export function validateLessonClarity(lesson: {
  goal?: string;
  explanation?: string;
  example?: string;
  interactiveCheck?: string;
  recap?: string;
}) {
  const required = ["goal", "explanation", "example", "interactiveCheck", "recap"] as const;
  const missing = required.filter((field) => !lesson[field]?.trim());
  return { ready: missing.length === 0, missing };
}
