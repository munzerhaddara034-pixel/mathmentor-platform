#!/usr/bin/env bash
# Tiny demo fixture for the lesson-video player preview (/lessons/preview/demo-sine).
# Generates — never commits — public/lesson-media/demo-sine/: silent master video 1080/720/480 (H.264, faststart),
# poster.jpg, narration audio.{en,ar,fr}.m4a (sine tones, exactly the video's duration), subtitles.{en,ar,fr}.vtt,
# chapters.vtt and lesson-en.mp4 (EN muxed review copy). Needs ffmpeg. Usage: scripts/make-lesson-demo.sh [out_dir]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-public/lesson-media/demo-sine}"
DUR=8
command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
mkdir -p "$OUT"
FF=(ffmpeg -hide_banner -loglevel error -y)

FONT=""
for candidate in /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /usr/share/fonts/dejavu/DejaVuSans-Bold.ttf /Library/Fonts/Arial.ttf; do
  [ -f "$candidate" ] && FONT="$candidate" && break
done
TEXT=""
if [ -n "$FONT" ]; then
  T="drawtext=fontfile=$FONT:fontcolor=white"
  TEXT=",${T}:fontsize=64:x=(w-text_w)/2:y=120:text='MathMentor · demo lesson'"
  TEXT+=",${T}@0.85:fontsize=44:x=(w-text_w)/2:y=210:text='1  y = sin x':enable='lt(t,3)'"
  TEXT+=",${T}@0.85:fontsize=44:x=(w-text_w)/2:y=210:text='2  period 2π':enable='between(t,3,6)'"
  TEXT+=",${T}@0.85:fontsize=44:x=(w-text_w)/2:y=210:text='3  summary':enable='gte(t,6)'"
fi

# Silent master: navy board, x-axis, the curve y = sin x (dotted) and a gold dot riding it.
CURVE=""
for i in $(seq 0 79); do
  X=$((160 + i * 20))
  Y=$(awk -v i="$i" 'BEGIN { printf "%d", 536 - 260 * sin(2 * 3.14159265 * i / 40) }')
  CURVE+=",drawbox=x=${X}:y=${Y}:w=8:h=8:color=0x7c6bff@0.9:t=fill"
done
"${FF[@]}" -f lavfi -i "color=c=0x0b1030:s=1920x1080:r=24:d=${DUR}" -f lavfi -i "color=c=0xf6c453:s=36x36:r=24:d=${DUR}" \
  -filter_complex "[0:v]drawbox=x=160:y=538:w=1600:h=4:color=0x3ddcf5@0.6:t=fill${CURVE}${TEXT}[bg];[bg][1:v]overlay=x='142+(t/${DUR})*1600':y='522-260*sin(2*PI*(t/${DUR})*2)':shortest=1" \
  -an -c:v libx264 -profile:v high -pix_fmt yuv420p -preset veryfast -crf 30 -movflags +faststart "$OUT/video.1080.mp4"
for H in 720 480; do
  "${FF[@]}" -i "$OUT/video.1080.mp4" -vf "scale=-2:${H}" -an -c:v libx264 -profile:v high -pix_fmt yuv420p -preset veryfast -crf 30 \
    -movflags +faststart "$OUT/video.${H}.mp4"
done
"${FF[@]}" -ss 1 -i "$OUT/video.1080.mp4" -frames:v 1 -vf scale=1280:-2 -q:v 6 "$OUT/poster.jpg"

# Narration stand-ins: one tone per language, each exactly DUR seconds from t=0.
declare -A HZ=([en]=440 [ar]=523 [fr]=659)
for L in en ar fr; do
  "${FF[@]}" -f lavfi -i "sine=frequency=${HZ[$L]}:sample_rate=44100:duration=${DUR}" -af "volume=0.25" -ac 1 -c:a aac -b:a 48k \
    -movflags +faststart "$OUT/audio.${L}.m4a"
done
"${FF[@]}" -i "$OUT/video.480.mp4" -i "$OUT/audio.en.m4a" -map 0:v -map 1:a -c copy -shortest -movflags +faststart "$OUT/lesson-en.mp4"

cat > "$OUT/subtitles.en.vtt" <<'VTT'
WEBVTT

00:00:00.200 --> 00:00:02.900
This is the sine function, y = sin x.

00:00:03.000 --> 00:00:05.900
It repeats every 2π: that is its period.

00:00:06.000 --> 00:00:07.900
Summary: a smooth wave between −1 and 1.
VTT
cat > "$OUT/subtitles.ar.vtt" <<'VTT'
WEBVTT

00:00:00.200 --> 00:00:02.900
هذه هي دالة الجيب: y = sin x.

00:00:03.000 --> 00:00:05.900
تتكرّر كل 2π، وهذا هو دورها.

00:00:06.000 --> 00:00:07.900
الخلاصة: موجة ملساء بين −1 و1.
VTT
cat > "$OUT/subtitles.fr.vtt" <<'VTT'
WEBVTT

00:00:00.200 --> 00:00:02.900
Voici la fonction sinus, y = sin x.

00:00:03.000 --> 00:00:05.900
Elle se répète tous les 2π : c’est sa période.

00:00:06.000 --> 00:00:07.900
Résumé : une onde régulière entre −1 et 1.
VTT
cat > "$OUT/chapters.vtt" <<'VTT'
WEBVTT

1
00:00:00.000 --> 00:00:03.000
The sine function

2
00:00:03.000 --> 00:00:06.000
Period 2π

3
00:00:06.000 --> 00:00:08.000
Summary
VTT
echo "demo fixture → $OUT"
du -ch "$OUT"/* | tail -1
