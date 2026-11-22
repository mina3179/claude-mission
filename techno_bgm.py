#!/usr/bin/env python3
"""테크노자동차정비 홍보영상용 30초 배경음악 + 효과음 합성기.

120BPM, D단조(Dm-Bb-Gm-A) 다크 럭셔리 일렉트로닉 비트를 numpy로 직접 합성합니다.
장면 전환(휘시), 로고 임팩트, 10년 보증 스탬프, 체크리스트 '틱' 효과음이
영상 타이밍(techno_promo.py의 SCENES)과 맞춰져 있습니다.

    python3 techno_bgm.py [출력경로.wav]

필요: numpy, scipy
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM          # 0.5s
BAR = BEAT * 4           # 2.0s
rng = np.random.default_rng(7)

# 장면 경계(초) — techno_promo.py 와 동일
CUTS = [3.0, 6.0, 11.0, 15.0, 19.0, 25.0, 27.5]
TICKS = [19.6, 21.2, 22.8]           # 체크리스트 체크 순간
STAMP = 15.7                         # 10년 보증 배지 스탬프

# 코드 진행 (bar 단위 반복): Dm - Bb - Gm - A
CHORDS = [
    (38, [62, 65, 69]),   # Dm : D2 / D4 F4 A4
    (34, [58, 62, 65]),   # Bb : Bb1 / Bb3 D4 F4
    (31, [55, 58, 62]),   # Gm : G1 / G3 Bb3 D4
    (33, [57, 61, 64]),   # A  : A1 / A3 C#4 E4
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    if np.ndim(f) == 0:
        f = min(f, SR / 2 * 0.95)
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def env_exp(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / decay)


def add(buf, sig, start, gain=1.0, pan=0.0):
    """buf: (2,N). pan -1..1"""
    i = int(start * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[0, i:j] += s * l * 1.414
    buf[1, i:j] += s * r * 1.414


# ---------------- instruments ----------------
def kick(dur=0.45):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env_exp(n, 0.16)
    click = filt(rng.standard_normal(n), "highpass", 2500) * env_exp(n, 0.004) * 0.35
    return np.tanh((s + click) * 1.6)


def clap():
    n = int(SR * 0.35)
    noise = filt(rng.standard_normal(n), "bandpass", [900, 3200])
    e = np.zeros(n)
    for k, off in enumerate([0.0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += env_exp(n - i, 0.006 if k < 2 else 0.09)
    return noise * e * 0.8


def hat(open_=False):
    d = 0.18 if open_ else 0.035
    n = int(SR * (d * 4))
    return filt(rng.standard_normal(n), "highpass", 7500) * env_exp(n, d) * 0.5


def crash(dur=2.2):
    n = int(SR * dur)
    s = filt(rng.standard_normal(n), "highpass", 4000) * env_exp(n, 0.7)
    return s * 0.45


def sub808(midi, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = hz(midi) * (1 + 0.6 * np.exp(-t / 0.02))
    ph = 2 * np.pi * np.cumsum(f) / SR
    a = np.minimum(1, t / 0.005) * np.exp(-t / (dur * 0.7))
    return np.tanh(np.sin(ph) * a * 2.2) * 0.9


def pluck(midi, dur=0.45, bright=3500):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = hz(midi)
    saw = 2 * ((t * f) % 1) - 1
    saw2 = 2 * ((t * f * 1.006) % 1) - 1
    s = filt(saw + saw2 * 0.7, "lowpass", bright) * env_exp(n, 0.12)
    return s * 0.25


def pad(midis, dur, cutoff=1400):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in midis:
        for det in (-0.08, 0.0, 0.08):
            f = hz(m) * 2 ** (det / 12)
            s += 2 * ((t * f + rng.random()) % 1) - 1
    s = filt(s, "lowpass", cutoff)
    a = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.6)
    return s * np.clip(a, 0, 1) * 0.045


def bell(midi, dur=2.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = hz(midi)
    s = (np.sin(2 * np.pi * f * t) * env_exp(n, 1.0)
         + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * env_exp(n, 0.45)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * env_exp(n, 0.2))
    return s * 0.18


def impact(dur=2.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 30 + 90 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.55)
    noise = filt(rng.standard_normal(n), "lowpass", 1800) * env_exp(n, 0.25) * 0.5
    return np.tanh((boom + noise) * 1.8) * 0.9


def whoosh(length=0.6, up=True):
    n = int(SR * length)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 시간에 따라 컷오프가 움직이는 저역통과를 블록 단위로 근사
    out = np.zeros(n)
    blocks = 24
    for b in range(blocks):
        i, j = b * n // blocks, (b + 1) * n // blocks
        p = (b + 0.5) / blocks
        fc = 400 + (6000 if up else 2500) * (p if up else 1 - p) ** 2
        out[i:j] = filt(noise, "bandpass", [fc * 0.5, fc * 1.6])[i:j]
    e = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    if up:
        e = (t / length) ** 2.2 * np.exp(-np.maximum(0, t - length * 0.85) / 0.05)
    return out * e * 0.55


def riser(length=1.5):
    n = int(SR * length)
    t = np.arange(n) / SR
    p = t / length
    noise = filt(rng.standard_normal(n), "highpass", 1500)
    f = 200 * 2 ** (p * 3)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (noise * 0.35 + tone) * p ** 2.5


def tick():
    n = int(SR * 0.25)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1760 * t) * env_exp(n, 0.05) + 0.6 * np.sin(2 * np.pi * 2637 * t) * env_exp(n, 0.04)
    click = filt(rng.standard_normal(n), "highpass", 5000) * env_exp(n, 0.002)
    return (s * 0.35 + click * 0.3)


def sparkle():
    out = np.zeros(int(SR * 2.0))
    for k, m in enumerate([86, 90, 93, 98, 102]):
        b = bell(m, 1.6) * 0.5
        i = int(k * 0.06 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out


# ---------------- arrangement ----------------
def build():
    dry = np.zeros((2, N))
    send = np.zeros((2, N))     # reverb send

    def both(sig, start, g=1.0, pan=0.0, rev=0.0):
        add(dry, sig, start, g, pan)
        if rev:
            add(send, sig, start, g * rev, pan)

    def chord_at(t):
        return CHORDS[int(t // BAR) % 4]

    # 섹션별 활성 구간
    def groove_on(t):
        return (6.0 <= t < 14.5) or (15.0 <= t < 25.0)

    # Pad: 전체 (아웃트로 포함)
    for bar in range(15):
        t0 = bar * BAR
        root, ch = CHORDS[bar % 4]
        cutoff = 900 if t0 < 6 else (1600 if t0 < 25 else 1100)
        both(pad(ch + [ch[0] - 12], BAR + 0.6, cutoff), t0, 1.0, 0, rev=0.6)

    # 인트로 드론 + 째깍
    n = int(SR * 3.0)
    tt = np.arange(n) / SR
    drone = np.tanh(np.sin(2 * np.pi * hz(26) * tt) * 2) * 0.35 * np.minimum(1, tt / 0.5)
    both(drone, 0.0)
    for k in range(int(0.5 / 0.25), int(3.0 / 0.25)):
        t = k * 0.25
        both(tick() * (0.35 if k % 2 else 0.6), t, 0.5, pan=(-0.4 if k % 2 else 0.4), rev=0.3)
    both(riser(1.6), 1.4, 0.8, rev=0.4)

    # 로고 임팩트 + 반짝
    both(impact(), 3.0, 1.0, rev=0.5)
    both(crash(), 3.0, 0.6, rev=0.4)
    both(sparkle(), 3.05, 0.9, pan=0.2, rev=0.8)
    both(sparkle(), 4.6, 0.6, pan=-0.3, rev=0.8)
    # 로고 구간: 1박 킥 + 벨
    for t in (4.0, 5.0):
        both(kick(), t, 0.7)
    for k, m in enumerate([74, 77, 81, 86]):
        both(bell(m, 2.0), 3.5 + k * 0.5, 0.5, pan=(-0.3 + 0.2 * k), rev=0.7)
    both(riser(0.9), 5.1, 0.6, rev=0.3)

    # 메인 그루브
    step = BEAT / 4  # 16분음표
    for k in range(int(DUR / step)):
        t = k * step
        if not groove_on(t):
            continue
        pos = k % 16            # bar 내 16분 위치
        root, ch = chord_at(t)
        # kick: 1, 2&, 3, 4& 패턴 (드라이빙)
        if pos in (0, 6, 8, 11):
            both(kick(), t, 0.95)
        # clap: 2, 4
        if pos in (4, 12):
            both(clap(), t, 0.7, rev=0.35)
        # hats: 8분 + 16분 고스트
        if pos % 2 == 0:
            both(hat(open_=(pos == 14)), t, 0.55 if pos % 4 == 2 else 0.35, pan=0.25)
        elif pos in (7, 15):
            both(hat(), t, 0.18, pan=-0.25)
        # 808 서브: 킥과 함께
        if pos in (0, 6, 8, 11):
            d = {0: 0.7, 6: 0.25, 8: 0.6, 11: 0.5}[pos]
            both(sub808(root + 12 if pos == 11 else root, d), t, 0.55)
        # 플럭 아르페지오: 8분
        if pos % 2 == 0:
            seq = [ch[0], ch[2], ch[1] + 12, ch[2], ch[0] + 12, ch[2], ch[1] + 12, ch[2] + 12]
            m = seq[(pos // 2) % 8]
            both(pluck(m, 0.4, 2600 if t < 15 else 3600), t, 0.6,
                 pan=(-0.35 if (pos // 2) % 2 else 0.35), rev=0.45)

    # 하이햇 롤 (전환 직전)
    for end in (11.0, 19.0):
        for k in range(8):
            both(hat(), end - 0.5 + k * 0.0625, 0.15 + k * 0.04, pan=0.1)

    # 10년 보증: 드롭 직전 정적 → 임팩트 → 스탬프
    both(riser(1.0), 14.0, 0.9, rev=0.4)
    both(impact(3.0), 15.0, 1.1, rev=0.6)
    both(crash(), 15.0, 0.7, rev=0.4)
    both(kick(), STAMP, 1.0)
    both(clap(), STAMP, 0.9, rev=0.6)
    both(crash(1.6), STAMP, 0.5, rev=0.3)
    both(sparkle(), STAMP + 0.05, 0.7, rev=0.8)

    # 체크리스트 틱
    for t in TICKS:
        both(tick(), t, 1.0, rev=0.4)
        both(bell(93, 1.2), t + 0.02, 0.6, rev=0.6)

    # 브레이크다운 (25–27.5): 필터된 플럭만
    for k in range(int(2.5 / (BEAT / 2))):
        t = 25.0 + k * BEAT / 2
        root, ch = chord_at(t)
        seq = [ch[0], ch[2], ch[1] + 12, ch[2]]
        both(pluck(seq[k % 4] + 12, 0.5, 1800), t, 0.45, pan=(-0.4 if k % 2 else 0.4), rev=0.8)
    both(riser(1.3), 26.2, 0.8, rev=0.4)

    # 엔딩 히트 + 꼬리
    both(impact(2.6), 27.5, 1.0, rev=0.6)
    both(crash(2.5), 27.5, 0.6, rev=0.5)
    for m in [50, 57, 62, 65, 69]:
        both(pluck(m, 2.4, 3000) * 1.4, 27.5, 0.7, rev=0.9)
    both(sub808(38, 2.4), 27.5, 0.6)
    both(sparkle(), 27.6, 0.7, rev=0.9)

    # 장면 전환 휘시
    for c in CUTS:
        if c in (3.0, 15.0, 27.5):
            continue
        both(whoosh(0.55), c - 0.5, 0.9, pan=0.0, rev=0.3)

    # 리버브
    ir_n = int(SR * 2.2)
    irt = np.arange(ir_n) / SR
    ir = np.stack([filt(rng.standard_normal(ir_n), "lowpass", 6000) * np.exp(-irt / 0.55) for _ in range(2)])
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.stack([fftconvolve(send[c], ir[c])[:N] for c in range(2)]) * 0.55

    mix = dry + wet
    # 사이드체인 느낌의 덕킹: 그루브 킥마다 패드/리버브 살짝 눌러줌은 생략, 마스터 처리
    mix = filt(mix, "highpass", 28)
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    # 페이드 아웃 (마지막 0.6초)
    fade = np.ones(N)
    fl = int(SR * 0.6)
    fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
    mix *= fade
    mix /= np.max(np.abs(mix)) + 1e-9
    return mix * 0.89


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "techno_bgm.wav"
    mix = build()
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", out)


if __name__ == "__main__":
    main()
