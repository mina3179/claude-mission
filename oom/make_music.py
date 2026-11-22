#!/usr/bin/env python3
"""OOM AESTHETIC 30초 배경음악 + 효과음 합성기 (numpy만 사용, 저작권 프리).

차분한 앰비언트 패드 + 소프트 피아노 아르페지오, 80 BPM.
효과음: 진단 태그 '틱'(6.0/6.6/7.2s), 도장(8.0s), 체크 '띵'(12.0s), 로고 벨(26.0s).

    python3 make_music.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 80
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, r, sr=SR):
    t = np.arange(n) / sr
    e = np.minimum(1, t / max(a, 1e-4))
    rel = np.clip((n / sr - t) / max(r, 1e-4), 0, 1)
    return e * rel


def fft_convolve(x, ir):
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:n]


def make_ir(seconds=3.2, decay=2.6):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t * decay)
    # 고역을 부드럽게 (단순 1차 저역통과)
    for c in range(2):
        y = np.empty(n)
        acc = 0.0
        a = 0.35
        for i in range(n):
            acc += a * (ir[c, i] - acc)
            y[i] = acc
        ir[c] = y
    ir[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return ir / np.abs(ir).max()


def reverb(st, ir, wet):
    out = np.zeros((2, st.shape[1] + ir.shape[1] - 1))
    for c in range(2):
        out[c] = fft_convolve(st[c], ir[c])
    out = out[:, : st.shape[1]]
    out /= max(np.abs(out).max(), 1e-9)
    return st * (1 - wet) + out * wet * np.abs(st).max()


# ---------- 화성 진행 (F 장조): Fmaj7 · Am7 · Dm9 · B♭maj7 · Fmaj7(add9)
CHORDS = [
    (0.0, [53, 57, 60, 64]),     # Fmaj7
    (6.0, [57, 60, 64, 67]),     # Am7
    (12.0, [50, 57, 60, 64, 65]),  # Dm9-ish
    (18.0, [46, 58, 62, 65, 69]),  # B♭maj7
    (24.0, [41, 53, 60, 64, 67, 69]),  # Fmaj7(add9) 피날레
]

t_all = np.arange(N) / SR
pad = np.zeros((2, N))
for idx, (start, notes) in enumerate(CHORDS):
    end = CHORDS[idx + 1][0] + 1.5 if idx + 1 < len(CHORDS) else DUR
    s, e = int(start * SR), min(N, int(end * SR))
    n = e - s
    tt = np.arange(n) / SR
    env = env_adsr(n, 1.6, 1.8 if idx + 1 < len(CHORDS) else 3.5)
    for k, m in enumerate(notes):
        f = midi(m + 12)
        for ch, det in enumerate((-0.12, 0.12)):
            ff = f * 2 ** (det / 12)
            tone = (np.sin(2 * np.pi * ff * tt)
                    + 0.30 * np.sin(2 * np.pi * 2 * ff * tt + 0.3)
                    + 0.10 * np.sin(2 * np.pi * 3 * ff * tt + 1.1))
            trem = 1 + 0.06 * np.sin(2 * np.pi * (0.18 + 0.03 * k) * tt + k)
            pad[ch, s:e] += tone * env * trem * 0.045
# 낮은 베이스 드론
for start, notes in CHORDS:
    pass

# ---------- 소프트 피아노 아르페지오 (8분음표, 확률적으로 비움)
piano = np.zeros((2, N))


def piano_note(m, t0, vel, length=2.4):
    f = midi(m)
    s = int(t0 * SR)
    n = min(int(length * SR), N - s)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    env = np.exp(-tt * 2.2) * np.minimum(1, tt / 0.004)
    tone = (np.sin(2 * np.pi * f * tt)
            + 0.45 * np.exp(-tt * 3) * np.sin(2 * np.pi * 2.001 * f * tt)
            + 0.18 * np.exp(-tt * 5) * np.sin(2 * np.pi * 3.003 * f * tt)
            + 0.06 * np.exp(-tt * 8) * np.sin(2 * np.pi * 4.01 * f * tt))
    pan = 0.5 + 0.35 * np.sin(m * 1.7)
    piano[0, s:s + n] += tone * env * vel * (1 - pan) * 2
    piano[1, s:s + n] += tone * env * vel * pan * 2


PATTERN = [0, 2, 1, 3, 2, 1, 3, 4]
for idx, (start, notes) in enumerate(CHORDS):
    end = CHORDS[idx + 1][0] if idx + 1 < len(CHORDS) else 25.5
    up = [n + 24 for n in notes[-4:]] + [notes[-3] + 36]
    step = 0
    t = start + BEAT  # 첫 박은 비워서 숨 쉬게
    while t < end - 0.05:
        if t > 0.8 and rng.random() > 0.22:
            m = up[PATTERN[step % len(PATTERN)] % len(up)]
            vel = 0.05 + 0.02 * rng.random()
            piano_note(m, t, vel)
        step += 1
        t += BEAT / 2
# 마지막 로고용 피아노 화음
for k, m in enumerate([65, 69, 72, 76, 79]):
    piano_note(m, 25.15 + k * 0.06, 0.06, 4.8)

# ---------- 효과음
sfx = np.zeros((2, N))


def add(buf, sig, t0, pan=0.5, gain=1.0):
    s = int(t0 * SR)
    n = min(len(sig), N - s)
    buf[0, s:s + n] += sig[:n] * gain * (1 - pan) * 2
    buf[1, s:s + n] += sig[:n] * gain * pan * 2


def tick(freq=2600):
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 70)
            + 0.3 * rng.standard_normal(n) * np.exp(-tt * 200))


def bell(f0, length=3.0, decay=1.6):
    n = int(length * SR)
    tt = np.arange(n) / SR
    parts = [(1, 1.0), (2.0, 0.5), (2.76, 0.35), (5.40, 0.18), (8.93, 0.08)]
    sig = sum(a * np.exp(-tt * decay * (1 + 0.6 * i)) * np.sin(2 * np.pi * f0 * r * tt)
              for i, (r, a) in enumerate(parts))
    return sig * np.minimum(1, tt / 0.002)


def thump():
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 120 * np.exp(-tt * 10) + 55
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 12)


def whoosh(length=1.2):
    n = int(length * SR)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 이동 평균으로 부드러운 노이즈
    k = 40
    noise = np.convolve(noise, np.ones(k) / k, mode="same")
    env = np.sin(np.pi * np.clip(tt / length, 0, 1)) ** 2
    return noise * env


# 장면 전환 숨결
for tr in (4.75, 9.75, 14.75, 19.75):
    add(sfx, whoosh(1.0), tr - 0.3, 0.5, 0.10)
add(sfx, whoosh(1.4), 24.4, 0.5, 0.12)
# 스캔 라인 (5.3–6.8s) 가벼운 스윕 톤
n = int(1.5 * SR)
tt = np.arange(n) / SR
sweep = np.sin(2 * np.pi * np.cumsum(900 + 700 * tt / 1.5) / SR) * np.sin(np.pi * tt / 1.5) ** 2
add(sfx, sweep, 5.3, 0.5, 0.025)
# 진단 태그 틱
for i, t0 in enumerate((6.0, 6.6, 7.2)):
    add(sfx, tick(2400 + 300 * i), t0, 0.35 + 0.15 * i, 0.16)
# 도장
add(sfx, thump(), 8.0, 0.5, 0.35)
add(sfx, tick(1800), 8.0, 0.5, 0.10)
# 체크 띵
add(sfx, bell(1318.5, 2.0, 2.4), 12.0, 0.55, 0.09)
# 세럼 방울
add(sfx, bell(1760, 1.2, 4.0), 16.2, 0.6, 0.06)
# 16 카운트 완료
add(sfx, bell(880, 2.5, 1.8), 22.0, 0.5, 0.07)
# 로고 벨
add(sfx, bell(698.5, 4.5, 0.9), 26.0, 0.5, 0.12)
add(sfx, bell(1046.5, 4.5, 1.1), 26.02, 0.5, 0.06)

ir = make_ir()
mix = reverb(pad, ir, 0.35) + reverb(piano, ir, 0.4) * 1.0 + reverb(sfx, ir, 0.25)

# 전체 페이드 인/아웃
fade_in = np.minimum(1, t_all / 1.2)
fade_out = np.clip((DUR - t_all) / 2.2, 0, 1)
mix *= fade_in * fade_out

# 소프트 리미터 + 노멀라이즈
mix = np.tanh(mix * 1.4)
mix /= np.abs(mix).max()
mix *= 0.80

out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
data = (mix.T * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("wrote", out)
