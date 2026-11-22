# OOM AESTHETIC · 30초 세로 홍보 영상

`oom_aesthetic_30s.mp4` — 1080×1920 (9:16), 30fps, H.264 + AAC, 30초.

콘셉트 **"피부를 읽는 작은 전문가들"**: 실사 미니어처 전문가들이 피부를 진단 → 맞춤 선택 → 케어하는 흐름으로 셀링포인트를 보여줍니다.

| 시간 | 장면 | 자막 |
|---|---|---|
| 0–5s | 돋보기로 피부결 관찰 | 같은 관리, 왜 나한테만 안 맞을까? |
| 5–10s | STEP 01 진단: 스캔 라인 · 유분/수분/민감도 태그 · 피부타입 도장 | 피부 타입부터 정확하게 진단하고 |
| 10–15s | STEP 02 선택: 선반에서 단 하나의 앰플 | 나에게 맞는 관리만 골라서 |
| 15–20s | STEP 03 케어: 세럼 한 방울 · 브러시 | 해드립니다 |
| 20–25s | 16 카운트업 | 16년의 노하우로 완성하는 프리미엄 케어 |
| 25–30s | 로고 엔드카드 | 당신의 피부를 먼저 읽습니다 |

- 영상 소스: Higgsfield (GPT Image 2.6 키프레임 → Kling 3.0 image-to-video), `clips/`, `keyframes/`
- 음악·효과음: `make_music.py`로 직접 합성 (F장조 앰비언트 패드 + 소프트 피아노, 80 BPM, 저작권 프리)
- 합성: `compose.py` (Pillow + ffmpeg). 폰트: Noto Serif CJK KR, Cormorant Garamond (OFL, `fonts/`)

### 다시 만들기

```bash
apt-get install -y ffmpeg fonts-noto-cjk
pip install pillow numpy
python3 make_music.py music.wav
python3 compose.py oom_aesthetic_30s.mp4
```

자막 문구와 타이밍은 `compose.py`의 `ov_s1` ~ `ov_end` 함수에서 바꿀 수 있습니다.
