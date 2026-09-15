import csv
import json
from collections import Counter
from pathlib import Path

source = Path('/home/ubuntu/index_attached_exam_library.json')
out_dir = Path('/home/ubuntu/mathmentor-platform/research')
out_dir.mkdir(parents=True, exist_ok=True)
data = json.loads(source.read_text())
valid = [row['output'] for row in data['results'] if row.get('output')]

fields = ['file_name','grade','branch','language','academic_year','page_count','has_corrections','skill_areas','question_formats','difficulty','life_sciences_relevance','rights_note']
with (out_dir / 'attached-exam-index-successful.csv').open('w', newline='', encoding='utf-8') as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    writer.writerows(valid)

skills = Counter()
branches = Counter()
for row in valid:
    branches[row.get('branch','unknown')] += 1
    for skill in row.get('skill_areas','').split(';'):
        skill = skill.strip()
        if skill:
            skills[skill] += 1

summary = [
    '# Successful attached-exam index',
    '',
    f'Only completed indexing results are included: **{len(valid)} files**. Incomplete results were excluded as requested.',
    '',
    '## Branch coverage',
    '',
    '| Branch | Files |',
    '|---|---:|',
]
summary += [f'| {branch} | {count} |' for branch, count in sorted(branches.items())]
summary += ['', '## Recurrent non-verbatim skill categories', '', '| Skill category | Files |', '|---|---:|']
summary += [f'| {skill} | {count} |' for skill, count in skills.most_common()]
summary += ['', '## Rights handling', '', 'These files are treated as reference material only. The platform must generate original wording, values, diagrams, and answer paths; it must not republish or reproduce exam questions or answer keys.']
(out_dir / 'attached-exam-index-successful.md').write_text('\n'.join(summary) + '\n', encoding='utf-8')
print(f'written {len(valid)} successful rows')
