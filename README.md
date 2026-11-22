# claude-mission

## subtitle_motion.mp4

5초짜리 자막 모션그래픽 (1920×1080, 30fps, H.264).

- 0.15–2.5s: **작은 아이디어가** / Every big change
- 2.55–4.85s: **큰 변화를 만듭니다** / starts with a small idea

글자별 튀어오름 등장, 오렌지 하이라이트 바 와이프, 글로우, 움직이는 컬러 배경·입자, 하단 진행 바.

### 다시 만들기

```bash
sudo apt-get install -y ffmpeg fonts-nanum
pip install pillow numpy
python3 motion_subtitle.py subtitle_motion.mp4
```

자막 문구는 `motion_subtitle.py`의 `CUES` 목록에서 바꿀 수 있습니다.

## techno_promo.mp4 — 김해 테크노자동차정비 홍보 모션그래픽

30초 세로 영상 (1080×1920, 9:16, 30fps, H.264 + AAC). 블랙 & 골드 톤.

| 시간 | 장면 | 카피 |
|---|---|---|
| 0–3s | 훅: HUD 스캔 + 글리치 | 사고 난 내 차, 어디서부터 맡겨야 할까? |
| 3–6s | 로고: 기어 + 렌치형 T 모노그램 | TECHNO / 테크노자동차정비 |
| 6–11s | 차량 블루프린트 스캔 + 콜아웃 | 전 차종 사고수리부터 판금·도장까지 |
| 11–15s | 3분할 공정 (판금·도장·사고수리) | 수리의 시작과 끝을 책임집니다 |
| 15–19s | 보증 방패 배지 스탬프 | 10년 무상 품질보증 |
| 19–25s | 서비스 체크리스트 + 진행 알림 | 무료 픽업·딜리버리 / 무상대차 / 수리 전 과정 고객 소통 |
| 25–27.5s | 클로징 | 맡기는 순간부터 찾는 날까지, 테크노가 끝까지. |
| 27.5–30s | 엔드카드 | 010-5505-0759 · 지금 바로 상담하세요 |

- 배경 사진: `assets/techno/img1~7.jpg` (Higgsfield GPT Image 2.6으로 생성)
- 배경음악: `techno_bgm.py`가 120BPM D단조 비트와 효과음을 직접 합성 (저작권 걱정 없음)
- 로고·HUD·텍스트 애니메이션: `techno_promo.py` (Pillow + numpy)

### 다시 만들기

```bash
sudo apt-get install -y ffmpeg fonts-nanum fonts-nanum-extra
pip install pillow numpy scipy
python3 techno_promo.py techno_promo.mp4
```

전화번호는 `PHONE`, 문구는 각 `scene*()` 함수에서 바꿀 수 있습니다.
미리보기 스틸: `python3 techno_promo.py --stills 4.9,17.5,29.5 stills`
