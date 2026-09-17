export type FormulaSheet = {
  id: string;
  title: string;
  titleAr: string;
  items: { name: string; latex: string; note?: string }[];
};

export const FORMULA_SHEETS: FormulaSheet[] = [
  {
    id: "logs",
    title: "Logarithms",
    titleAr: "اللوغاريتمات",
    items: [
      { name: "Product", latex: "\\log_a(xy)=\\log_a x+\\log_a y" },
      { name: "Quotient", latex: "\\log_a\\frac{x}{y}=\\log_a x-\\log_a y" },
      { name: "Power", latex: "\\log_a(x^k)=k\\log_a x" },
      { name: "Change of base", latex: "\\log_a x=\\frac{\\ln x}{\\ln a}" },
      { name: "Inverse", latex: "\\ln(e^x)=x,\\quad e^{\\ln x}=x\\ (x>0)" },
    ],
  },
  {
    id: "integrals",
    title: "Integrals",
    titleAr: "التكاملات",
    items: [
      { name: "Power", latex: "\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C\\ (n\\neq-1)" },
      { name: "Exponential", latex: "\\int e^{ax}\\,dx=\\frac{1}{a}e^{ax}+C" },
      { name: "Logarithm", latex: "\\int \\frac{1}{x}\\,dx=\\ln|x|+C" },
      { name: "Parts", latex: "\\int u\\,dv=uv-\\int v\\,du" },
      { name: "Linearity", latex: "\\int(\\alpha f+\\beta g)=\\alpha\\int f+\\beta\\int g" },
    ],
  },
  {
    id: "probability",
    title: "Probability",
    titleAr: "الاحتمالات",
    items: [
      { name: "Complement", latex: "P(\\overline{A})=1-P(A)" },
      { name: "Union", latex: "P(A\\cup B)=P(A)+P(B)-P(A\\cap B)" },
      { name: "Independent", latex: "P(A\\cap B)=P(A)P(B)" },
      { name: "Conditional", latex: "P(A|B)=\\frac{P(A\\cap B)}{P(B)}" },
      { name: "Binomial", latex: "P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}" },
    ],
  },
  {
    id: "complex",
    title: "Complex numbers",
    titleAr: "الأعداد العقدية",
    items: [
      { name: "Form", latex: "z=a+ib=|z|(\\cos\\theta+i\\sin\\theta)" },
      { name: "Modulus", latex: "|z|=\\sqrt{a^2+b^2}" },
      { name: "Conjugate", latex: "z\\bar z=|z|^2" },
      { name: "Euler", latex: "e^{i\\theta}=\\cos\\theta+i\\sin\\theta" },
      { name: "De Moivre", latex: "[r(\\cos\\theta+i\\sin\\theta)]^n=r^n(\\cos n\\theta+i\\sin n\\theta)" },
    ],
  },
];
