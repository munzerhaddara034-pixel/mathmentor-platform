import json
from pathlib import Path

root = Path('/home/ubuntu/mathmentor-platform/research')
rows = []
for source in sorted(root.glob('*-draft-input-generated.json')):
    drafts = json.loads(source.read_text())
    for draft in drafts:
        question_ref = f"{draft['model_id']}/{draft['question_id']}"
        storyboard_en = json.dumps(draft['storyboard_en'], ensure_ascii=False)
        storyboard_ar = json.dumps(draft['storyboard_ar'], ensure_ascii=False)
        rows.append({
            'skill': draft['skill'],
            'question_ref': question_ref,
            'video_script': draft['video_script_en'] + '\n\nStoryboard:\n' + storyboard_en,
            'printable_solution': draft['printable_solution_en'],
            'language': 'en',
            'status': 'awaiting_approval',
        })
        rows.append({
            'skill': draft['skill'],
            'question_ref': question_ref,
            'video_script': draft['video_script_ar'] + '\n\nالمشاهد:\n' + storyboard_ar,
            'printable_solution': draft['printable_solution_ar'],
            'language': 'ar',
            'status': 'awaiting_approval',
        })

def sql_quote(value: str) -> str:
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"

values = ',\n'.join(
    '(' + ', '.join([
        sql_quote(row['skill']), sql_quote(row['question_ref']), sql_quote(row['video_script']),
        'NULL', sql_quote(row['printable_solution']), sql_quote(row['language']), sql_quote(row['status'])
    ]) + ')'
    for row in rows
)
sql = "INSERT INTO solution_assets (skill, questionRef, videoScript, videoUrl, printableSolution, language, status) VALUES\n" + values + ";\n"
Path('/home/ubuntu/mathmentor-platform/research/solution-assets-ai-batch.sql').write_text(sql)
print(json.dumps({'rows': len(rows), 'questions': len(rows)//2}))
