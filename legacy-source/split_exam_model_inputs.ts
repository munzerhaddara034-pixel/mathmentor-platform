import { readFileSync, writeFileSync } from "node:fs";

type Item = { modelId: string };
const items = JSON.parse(readFileSync("/home/ubuntu/mathmentor-platform/research/exam-model-question-inputs.json", "utf8")) as Item[];
const groups = new Map<string, Item[]>();
for (const item of items) groups.set(item.modelId, [...(groups.get(item.modelId) ?? []), item]);
for (const [modelId, group] of groups) {
  writeFileSync(`/home/ubuntu/mathmentor-platform/research/${modelId}-draft-input.json`, JSON.stringify(group, null, 2));
}
console.log(JSON.stringify([...groups.entries()].map(([modelId, group]) => ({ modelId, questions: group.length }))));
