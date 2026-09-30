import type { CurriculumStyle } from "./types";

/** French Baccalauréat, Terminale spécialité mathématiques. */
export const FRENCH_BAC_STYLE: CurriculumStyle = {
  id: "french_bac",
  labelEn: "French Baccalauréat (Terminale spécialité maths)",
  rules: [
    "Rédaction: 'Soit …', 'On a …', 'Donc …', 'On en déduit que …', 'D'après le théorème …' ; conclude each question with a full sentence.",
    "Récurrence in three labelled parts: Initialisation, Hérédité (suppose P(n) vrai, montrer P(n+1)), Conclusion ('par récurrence, pour tout n ∈ ℕ …').",
    "Suites: monotone + bornée ⇒ convergente (théorème de convergence monotone); limit by passage à la limite / point fixe only after convergence is proved.",
    "Fonctions: tableau de variations complet (\\begin{array}), limites par 'croissance comparée' named, corollaire du TVI with 'continue et strictement monotone'.",
    "Notation française: virgule décimale (2{,}10), intervals ]a ; b[, ℕ, ℝ, exact values before decimal ones; calculatrice allowed but every result is justified.",
  ],
};
