import type { CurriculumStyle } from "./types";

/** AP Calculus AB / BC free-response conventions (College Board scoring guidelines). */
export const AP_STYLE: CurriculumStyle = {
  id: "ap",
  labelEn: "AP Calculus AB / BC",
  rules: [
    "Every conclusion needs a justification SENTENCE tied to calculus: e.g. 'v(t) changes sign from positive to negative at t = 1, so the particle changes direction'; never 'the graph shows'.",
    "Speed: compare signs of v(t) and a(t) ('same sign ⇒ speeding up, opposite ⇒ slowing down'). Extrema: sign change of f' or the Candidates Test for absolute extrema.",
    "Theorems (MVT, IVT, EVT): state the hypotheses explicitly ('f is continuous on [a, b] and differentiable on (a, b)').",
    "Write the setup (definite integral with limits and dt) before the value; answers with units ('meters', 'm/s'); decimals correct to three places; no need to simplify arithmetic.",
    "Total distance = \\int |v(t)| dt, split at sign changes. BC series: name the test and verify its conditions; state the error bound used.",
  ],
};
