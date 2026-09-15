import json
from pathlib import Path
from urllib.request import urlopen

root = Path('/home/ubuntu/mathmentor-platform')
result = json.loads(Path('/home/ubuntu/regenerate_exam_solution_drafts_strict.json').read_text())
for item in result['results']:
    source = Path(item['input'])
    url = item['output']['draft_file']
    target = root / 'research' / f'{source.stem}-generated.json'
    with urlopen(url, timeout=60) as response:
        target.write_bytes(response.read())
    print(target)
