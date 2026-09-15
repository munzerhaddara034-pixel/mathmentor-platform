import json
from pathlib import Path

root = Path('/home/ubuntu/mathmentor-platform')
items = []
for source in sorted((root / 'research').glob('*-draft-input-generated.json')):
    items.extend(json.loads(source.read_text()))
(root / 'shared' / 'aiSolutionDrafts.ts').write_text(
    'export type AiSolutionDraft = typeof aiSolutionDrafts[number];\n\n'
    'export const aiSolutionDrafts = ' + json.dumps(items, ensure_ascii=False, indent=2) + ' as const;\n'
    '\nexport const aiSolutionDraftCount = aiSolutionDrafts.length;\n'
)
print(json.dumps({'drafts': len(items)}))
