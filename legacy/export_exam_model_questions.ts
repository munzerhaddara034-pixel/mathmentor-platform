import { writeFileSync } from "node:fs";
import { examModels } from "../shared/examModels";

const items = examModels.flatMap((model) => model.questions.map((question) => ({
  modelId: model.id,
  modelTitle: model.title,
  branch: model.branch,
  grade: model.grade,
  difficulty: model.difficulty,
  questionId: question.id,
  skill: question.skill,
  prompt: question.prompt,
  arabicPrompt: question.arabicPrompt,
  options: question.options,
  correctAnswer: question.options[question.correctIndex],
  explanation: question.explanation,
  arabicExplanation: question.arabicExplanation,
})));
writeFileSync("/home/ubuntu/mathmentor-platform/research/exam-model-question-inputs.json", JSON.stringify(items, null, 2));
console.log(JSON.stringify({ models: examModels.length, questions: items.length, modelIds: examModels.map((model) => model.id) }));
