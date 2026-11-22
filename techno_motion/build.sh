#!/usr/bin/env bash
# 전체 빌드: 효과음 큐 추출 → 오디오 합성 → 900프레임 렌더 → MP4 인코딩
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
node render/render.js --cues-only
python3 audio/make_audio.py out/sfx_cues.json out/audio.wav
node render/render.js --workers "${WORKERS:-4}" --out out/techno_onestop_30s.mp4 --audio out/audio.wav
rm -rf out/frames
echo "완료: out/techno_onestop_30s.mp4"
