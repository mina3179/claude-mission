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
