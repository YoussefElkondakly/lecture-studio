#!/usr/bin/env bash
# Regenerates the bundled synthetic media in public/samples (macOS: uses `say` + ffmpeg).
# The outputs are committed so the prototype runs anywhere without these tools.
# All clips are clearly labelled placeholders — never real lecture audio or video.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/samples
TMP=$(mktemp -d)
mkdir -p "$OUT"

EN=(
  "Synthetic narration sample one. This placeholder clip stands in for a generated voice chunk in the Lecture Studio prototype."
  "Synthetic narration sample two. In the real product, each chunk would be sixty to ninety seconds of approved transcript."
  "Synthetic narration sample three. The measured duration shown on screen is simulated, not the length of this clip."
  "Synthetic narration sample four. Listen for pace and tone; this voice was produced on the developer's computer."
  "Synthetic narration sample five. Approving audio here never changes the transcript text approved earlier."
  "Synthetic narration sample six. Thank you for reviewing this prototype."
)
AR=(
  "عينة صوت تجريبية رقم واحد. ده مقطع بديل للصوت الحقيقي في النموذج الأولي."
  "عينة صوت تجريبية رقم اتنين. كل جزء في المنتج الحقيقي هيكون من ستين لتسعين ثانية."
  "عينة صوت تجريبية رقم تلاتة. المدة اللي ظاهرة على الشاشة محاكاة."
  "عينة صوت تجريبية رقم أربعة. اسمع السرعة ونبرة الصوت."
  "عينة صوت تجريبية رقم خمسة. الموافقة على الصوت مش بتغير النص."
  "عينة صوت تجريبية رقم ستة. شكراً لمراجعة النموذج."
)
for i in "${!EN[@]}"; do
  n=$(printf "%02d" $((i+1)))
  voice=$([ $((i % 2)) -eq 0 ] && echo "Samantha" || echo "Daniel")
  say -v "$voice" -o "$TMP/en$n.aiff" "${EN[$i]}"
  ffmpeg -loglevel error -y -i "$TMP/en$n.aiff" -ac 1 -ar 22050 -c:a aac -b:a 48k "$OUT/voice-en-$n.m4a"
  say -v "Majed" -o "$TMP/ar$n.aiff" "${AR[$i]}"
  ffmpeg -loglevel error -y -i "$TMP/ar$n.aiff" -ac 1 -ar 22050 -c:a aac -b:a 48k "$OUT/voice-ar-$n.m4a"
done

# Final video sample: four labelled title cards (rendered by Playwright) over the first three English clips.
ffmpeg -loglevel error -y -i "$TMP/en01.aiff" -i "$TMP/en02.aiff" -i "$TMP/en03.aiff" \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1,apad=pad_dur=1[a]" -map "[a]" -ac 1 -ar 44100 "$TMP/narr.wav"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/narr.wav")
SEG=$(python3 -c "print(round($DUR/4, 2))")
node scripts/render-cards.mjs "$TMP"
for i in 1 2 3 4; do
  ffmpeg -loglevel error -y -loop 1 -t "$SEG" -i "$TMP/card$i.png" -r 30 -c:v libx264 -pix_fmt yuv420p "$TMP/card$i.mp4"
done
printf "file '%s'\n" "$TMP"/card{1,2,3,4}.mp4 > "$TMP/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -i "$TMP/narr.wav" -c:v libx264 -crf 30 -preset veryslow -pix_fmt yuv420p \
  -c:a aac -b:a 64k -shortest -movflags +faststart "$OUT/final-video-sample.mp4"
# Poster image
ffmpeg -loglevel error -y -ss 0.5 -i "$OUT/final-video-sample.mp4" -frames:v 1 -q:v 4 "$OUT/final-video-poster.jpg"
rm -rf "$TMP"
ls -la "$OUT"
