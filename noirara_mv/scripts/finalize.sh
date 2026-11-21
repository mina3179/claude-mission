#!/usr/bin/env bash
# Mux the untouched original MP3 into the rendered video (stream copy, no re-encode)
# and run the technical checks.
set -euo pipefail
cd "$(dirname "$0")/.."
AUDIO=assets/audio/noirara_original.mp3
OUT=${OUT:-output/Noirara_MV_revised_1080x1920.mp4}
ffmpeg -v error -y -i build/video_noaudio.mp4 -i "$AUDIO" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy \
  -metadata title="Noirara — BEHIND THE LIGHT" -movflags +faststart "$OUT"
echo "== streams"; ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels,bit_rate -of compact "$OUT"
echo "== container duration"; ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "== audio bit-exact check (MP3 packet payload CRCs: original vs final)"
crc() { ffmpeg -v error -i "$1" -map 0:a -c copy -f framecrc - | grep -v '^#' | awk -F', *' '{print $5, $6}'; }
if diff <(crc "$AUDIO") <(crc "$OUT") >/dev/null; then
  echo "OK: all $(crc "$AUDIO" | wc -l) MP3 packets are byte-identical to the original"
else
  echo "MISMATCH"; exit 1
fi
