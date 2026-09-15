from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path('/home/ubuntu/webdev-static-assets/promo-cards')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1280, 720
navy = '#10213d'
navy2 = '#172b4c'
gold = '#d9aa53'
cream = '#f7f9fc'
muted = '#c7d4e6'

font_paths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
]
bold_paths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
]
font_path = next((p for p in font_paths if Path(p).exists()), font_paths[0])
bold_path = next((p for p in bold_paths if Path(p).exists()), bold_paths[0])

def f(size, bold=False):
    return ImageFont.truetype(bold_path if bold else font_path, size)

def card(index, eyebrow, title, lines, accent='gold'):
    im = Image.new('RGB', (W, H), navy)
    d = ImageDraw.Draw(im)
    d.ellipse((850, -220, 1430, 360), outline='#365276', width=2)
    d.ellipse((1010, 100, 1380, 470), outline='#294467', width=2)
    d.line((76, 92, 210, 92), fill=gold, width=5)
    d.text((76, 125), eyebrow.upper(), fill=gold, font=f(22, True))
    d.text((76, 182), title, fill=cream, font=f(52, True))
    y = 285
    for line in lines:
        d.rounded_rectangle((76, y + 5, 92, y + 21), radius=8, fill=gold)
        d.text((122, y - 8), line, fill=muted, font=f(28))
        y += 66
    d.text((76, 642), 'MUNZER HADDARA MATH ACADEMY', fill='#f0d8a7', font=f(18, True))
    d.text((1160, 640), f'{index:02d}', fill='#6f87a6', font=f(22, True))
    im.save(OUT / f'card-{index:02d}.png')

card(1, 'A clearer way to master mathematics', 'Build confidence, one proof at a time.', ['English-first mathematics learning', 'A focused path for students and families'])
card(2, 'Learn with Professor Munzer Haddara', 'Guidance that makes each step count.', ['Clear explanations and worked examples', 'Practice, feedback, and a next step'])
card(3, 'Lebanese Certificate preparation', 'Grade 9 and Grade 12, organised.', ['Curriculum-aligned lessons and revision', 'Exam practice built around understanding'])
card(4, 'SAT Math preparation', 'Prepare with focus. Practice with purpose.', ['Diagnostic direction and four core domains', 'Timed practice, contests, and review'])
card(5, 'Your learning toolkit', 'Support whenever a problem feels difficult.', ['Daily study plan and homework helper', 'AI Tutor explains the method step by step'])
card(6, 'Progress you can see', 'Know what to improve next.', ['Mastery, accuracy, and contest performance', 'A clearer view for students, parents, and Professor Munzer'])
card(7, 'Start your journey', 'A stronger mathematics routine begins here.', ['Learn in English. Practice with care.', 'Munzer Haddara Math Academy'])
card(8, 'Simple enrollment for families', 'Whish Money support with a human review.', ['Send your enrollment details through the dedicated process', 'Professor approval comes before premium access'])
card(9, 'Professor Munzer’s management view', 'Every important action begins with a conversation.', ['Review proposals, progress, and teaching priorities', 'Approve before publishing, messaging, pricing, or access'])
