# Noirara — BEHIND THE LIGHT (헌정 뮤직비디오)

Remotion 프로젝트입니다. 1080×1920, 30fps, 64.824초 길이이며, 오디오는 원본 MP3 스트림을 그대로 넣습니다.

- 제작 지시문: `CLAUDE_CODE_지시문.md`
- 샷 리스트와 타이밍: `output/shot_list.md`
- 타임라인(비트·가사·헌정 문구): `src/timeline.ts` / 장면: `src/scenes.tsx` / 합성·자막: `src/MV.tsx`

## 다시 만들기
소재 패키지의 `assets/` 폴더(audio, webtoon, provided_photos)를 이 폴더에 넣은 뒤 실행하세요.
이 저장소는 공개 저장소라서 실제 인물 사진, 작품, 음원, 결과 영상은 커밋하지 않았습니다.

```bash
npm install
pip install pillow numpy
python3 prep/prepare_assets.py
export REMOTION_BROWSER=/path/to/chrome-headless-shell
node scripts/render.mjs video build/video_noaudio.mp4
node scripts/render.mjs poster output/NOIRARA_MV_poster.jpg
scripts/finalize.sh
```

`finalize.sh`는 원본 MP3를 재인코딩하지 않고(`-c:a copy`) 영상과 합칩니다. 원본과 결과물의 오디오 PCM md5도 비교해서 출력합니다.
