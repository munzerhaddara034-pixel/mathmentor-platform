import json
from pathlib import Path

root = Path('/home/ubuntu/mathmentor-platform/research')
required = {
    'model_id', 'question_id', 'skill', 'written_explanation_en', 'written_explanation_ar',
    'video_script_en', 'video_script_ar', 'storyboard_en', 'storyboard_ar',
    'printable_solution_en', 'printable_solution_ar', 'common_mistake_en',
    'common_mistake_ar', 'status', 'approval_note'
}
errors = []
total = 0
for source in sorted(root.glob('*-draft-input.json')):
    generated = root / f'{source.stem}-generated.json'
    if not generated.exists():
        errors.append(f'missing generated file: {generated.name}')
        continue
    inputs = json.loads(source.read_text())
    drafts = json.loads(generated.read_text())
    if len(inputs) != len(drafts):
        errors.append(f'{source.name}: expected {len(inputs)} drafts, got {len(drafts)}')
    input_ids = {item['questionId'] for item in inputs}
    draft_ids = {item.get('question_id') for item in drafts}
    if input_ids != draft_ids:
        errors.append(f'{source.name}: question IDs do not match')
    for draft in drafts:
        total += 1
        missing = sorted(required - set(draft))
        if missing:
            errors.append(f"{source.name}/{draft.get('question_id')}: missing {missing}")
        if draft.get('status') != 'awaiting_approval':
            errors.append(f"{source.name}/{draft.get('question_id')}: status is not awaiting_approval")
        for key in required - {'status', 'storyboard_en', 'storyboard_ar'}:
            if key in draft and (not isinstance(draft[key], str) or not draft[key].strip()):
                errors.append(f"{source.name}/{draft.get('question_id')}: empty {key}")
        for key in ('storyboard_en', 'storyboard_ar'):
            value = draft.get(key)
            if not isinstance(value, list) or len(value) < 3:
                errors.append(f"{source.name}/{draft.get('question_id')}: {key} must contain at least 3 scenes")
            elif any(not isinstance(scene, dict) or not scene.get('description') or not scene.get('math_direction') for scene in value):
                errors.append(f"{source.name}/{draft.get('question_id')}: {key} contains an incomplete scene")
print(json.dumps({'total_drafts': total, 'errors': errors, 'valid': not errors}, ensure_ascii=False))
if errors:
    raise SystemExit(1)
