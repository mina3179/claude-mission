// All timings are measured from the original track (assets/audio/noirara_original.mp3).
// Beat grid: librosa beat tracking on the full mix (~117.7 BPM, one lyric line = 8 beats).
// Lyric starts: vocal-stem (spleeter) onsets, verified line-by-line with Whisper-small recognition.
export const FPS = 30;
export const DURATION_S = 64.824;
export const DURATION_FRAMES = Math.ceil(DURATION_S * FPS); // 1945

export const BEATS: number[] = [0.418, 0.952, 1.486, 1.997, 2.508, 3.042, 3.553, 4.087, 4.598, 5.108, 5.619, 6.13, 6.664, 7.198, 7.686, 8.197, 8.731, 9.265, 9.752, 10.286, 10.797, 11.308, 11.819, 12.353, 12.864, 13.375, 13.886, 14.396, 14.93, 15.441, 15.952, 16.463, 16.951, 17.508, 18.019, 18.53, 19.04, 19.574, 20.085, 20.596, 21.107, 21.618, 22.152, 22.639, 23.174, 23.684, 24.195, 24.729, 25.24, 25.751, 26.262, 26.773, 27.26, 27.794, 28.305, 28.816, 29.327, 29.838, 30.348, 30.859, 31.37, 31.881, 32.392, 32.903, 33.39, 33.924, 34.435, 34.946, 35.457, 35.968, 36.479, 36.989, 37.5, 38.011, 38.522, 39.033, 39.544, 40.054, 40.542, 41.053, 41.564, 42.075, 42.562, 43.073, 43.584, 44.095, 44.582, 45.093, 45.604, 46.092, 46.626, 47.113, 47.624, 48.135, 48.646, 49.133, 49.644, 50.132, 50.643, 51.154, 51.641, 52.129, 52.64, 53.15, 53.638, 54.149, 54.66, 55.147, 55.635, 56.146, 56.657, 57.144, 57.632, 58.143, 58.63, 59.141, 59.629, 60.116, 60.627, 61.115, 61.626, 62.113, 62.601, 63.112, 63.599, 64.087];
export const B = (i: number) => BEATS[i];

export type Lyric = { s: number; e: number; text: string };
const L = (s: number, text: string): Lyric => ({ s, e: 0, text });
export const LYRICS: Lyric[] = [
  L(0.72, "거울 앞에서 망설이던 날"),
  L(3.58, "작가님은 먼저 웃어줬죠"),
  L(7.48, "그대로 좋아요, 편히 웃어봐요"),
  L(11.8, "그 한마디에 나도 웃었죠"),
  L(16.02, "조명 하나, 각도 하나까지"),
  L(20.0, "한 컷에도 온 마음을 다하죠"),
  L(24.06, "더 좋은 순간을 찾는 그 열정에"),
  L(28.25, "나도 모르게 반짝였죠"),
  L(32.3, "찰칵! 셔터 소리 한 번에"),
  L(36.52, "가장 나다운 나를 만났죠"),
  L(40.45, "두 번 세 번, 열 번이라도"),
  L(44.5, "노이라라, 다시 찾아갈게요"),
  L(48.5, "계절이 바뀌고 이름이 바뀌어도"),
  L(52.6, "그 따뜻한 시선은 그대로였죠"),
  L(56.75, "작가님, 오래도록 고마워요"),
];
LYRICS.forEach((l, i) => (l.e = i < LYRICS.length - 1 ? LYRICS[i + 1].s - 0.12 : 59.45));

// Dedication lines are typed syllable by syllable (Array.from on precomposed Hangul) with a cursor.
export const TYPE_STEP = 0.075; // seconds per character for lines 1-2
export const DEDICATION = [
  { s: 50.85, text: "누군가의 가장 아름다운 순간을 발견하기 위해" },
  { s: 53.0, text: "늘 카메라 뒤에서 최선을 다하는 사람." },
];
export const DEDICATION_OUT = 56.35;
export const FINAL_LINE = "그 열정과 진심에 감사드립니다.";
export const FINAL_LINE_START = 57.35; // typed under the original logo, then held through the brand scene
export const FINAL_TYPE_STEP = 0.085;
export const BRAND = "Noirara"; // N uppercase, "oirara" lowercase – never NOIRARA / noirara
export const LETTER_START = B(116); // ~59.63s
export const LETTER_STEP = (B(118) - B(116)) / 4; // eighth note
