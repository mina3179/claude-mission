#!/usr/bin/env python3
"""배경음악 + 효과음을 코드로 합성해서 out/audio.wav (30초, 44.1kHz 스테레오) 생성.

- BGM: 120BPM C장조, 우쿨렐레(Karplus-Strong) 스트럼 + 베이스 + 글로켄슈필 + 가벼운 퍼커션
  · 0~4초 잔잔 → 4~7.15초 바쁘게 → 7.15초 '정지!' (음악 멈춤) → 8초 '걱정 마세요!'부터 풀 편성
  · 29초 마지막 화음으로 마무리
- 효과음: out/sfx_cues.json (src/main.js 의 SFX 목록) 의 시각에 배치
    boing(뿅) / shutter(찰칵) / swoosh·whoosh(슝) / pop(팝) / sparkle(반짝) / ding / tick / spray / stop

    python3 audio/make_audio.py [cues.json] [out.wav]
필요: numpy, scipy
"""
import json
import os
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
FREEZE = (7.15, 8.0)          # 음악 정지 구간 (Scene 2 물음표)
rng = np.random.default_rng(7)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'sfx_cues.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'out', 'audio.wav')


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.05):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    e = np.where(t >= a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)), e)
    rel = int(r * SR)
    if rel and n > rel:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


# ---------------- 악기 ----------------
_ks_cache = {}


def pluck(freq, dur=1.6, bright=0.5, decay=0.996):
    """Karplus-Strong 우쿨렐레 플럭 (블록 단위 벡터화)."""
    key = (round(freq, 2), dur, bright)
    if key in _ks_cache:
        return _ks_cache[key]
    L = int(dur * SR)
    P = max(2, int(round(SR / freq)))
    y = np.zeros(L + P + 2)
    exc = rng.uniform(-1, 1, P)
    exc = lp(exc, 1500 + 5000 * bright, 1)
    y[:P] = exc
    i = P + 1
    while i < len(y):
        j = min(i + P, len(y))
        y[i:j] = decay * 0.5 * (y[i - P:j - P] + y[i - P - 1:j - P - 1])
        i = j
    out = y[:L] * env_adsr(L, 0.001, dur * 2, 1.0, 0.05)
    out = hp(out, 120)
    out /= np.max(np.abs(out)) + 1e-9
    _ks_cache[key] = out
    return out


def bell(freq, dur=0.9, decay=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 6)
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 12))
    return s * np.exp(-t / decay) * np.minimum(1, t / 0.002)


def bass_note(freq, dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t) + 0.1 * np.sin(2 * np.pi * 3 * freq * t)
    return s * env_adsr(n, 0.008, 0.25, 0.25, 0.06)


def kick():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


def snap():
    n = int(0.15 * SR)
    t = np.arange(n) / SR
    return bp(rng.uniform(-1, 1, n), 1200, 4500) * np.exp(-t * 32) * 1.6


def shaker():
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    return hp(rng.uniform(-1, 1, n), 6000) * np.minimum(1, t / 0.01) * np.exp(-t * 60)


# ---------------- 믹싱 버스 ----------------
L_ch = np.zeros(N + SR * 3)
R_ch = np.zeros(N + SR * 3)


def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    sig = sig[:len(L_ch) - i]
    gl, gr = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    L_ch[i:i + len(sig)] += sig * gain * gl
    R_ch[i:i + len(sig)] += sig * gain * gr


def muted(t):
    return FREEZE[0] <= t < FREEZE[1]


# ---------------- BGM ----------------
# 우쿨렐레 보이싱 (G4 C4 E4 A4 튜닝 느낌의 midi)
CHORDS = {
    'C': [67, 60, 64, 72], 'G': [67, 62, 71, 74], 'Am': [69, 60, 64, 72], 'F': [69, 60, 65, 72],
    'Dm': [69, 62, 65, 74], 'Em': [67, 64, 71, 76],
}
ROOTS = {'C': 36, 'G': 43, 'Am': 45, 'F': 41, 'Dm': 38, 'Em': 40}
PROG = ['C', 'G', 'Am', 'F'] * 3 + ['Dm', 'G', 'C']          # 15마디 = 30초
STRUM = [(0, 'D', 1.0), (1, 'D', .7), (1.5, 'U', .55), (2.5, 'U', .55), (3, 'D', .8), (3.5, 'U', .55)]
# 글로켄 멜로디 (박, midi, 길이) — 2마디 단위 반복 모티프
MEL_A = [(0, 79, 1), (1, 76, .5), (1.5, 79, .5), (2, 81, 1), (3, 79, 1), (4, 76, .5), (4.5, 74, .5), (5, 72, 1), (6, 74, 1.5)]
MEL_B = [(0, 81, 1), (1, 79, .5), (1.5, 76, .5), (2, 77, 1), (3, 76, 1), (4, 74, .5), (4.5, 72, .5), (5, 74, 1), (6, 72, 2)]

for b, ch in enumerate(PROG):
    t0 = b * BAR
    section = 'intro' if t0 < 4 else 'busy' if t0 < 8 else 'full'
    # 우쿨렐레 스트럼
    for beat, d, vel in STRUM:
        tt = t0 + beat * BEAT
        if muted(tt) or tt >= 29.0:
            continue
        if section == 'intro' and beat not in (0, 2.5, 3):
            continue
        notes = CHORDS[ch] if d == 'D' else CHORDS[ch][::-1]
        for k, m in enumerate(notes):
            put(pluck(midi(m), 1.4, .45 + .3 * vel), tt + k * 0.012, .17 * vel, pan=-.25 + k * .05)
    # 베이스
    if section != 'intro':
        for beat, off in [(0, 0), (2, 0), (3.5, 7)]:
            tt = t0 + beat * BEAT
            if not muted(tt) and tt < 29.0:
                put(bass_note(midi(ROOTS[ch] + 12 + off)), tt, .32)
    else:
        put(bass_note(midi(ROOTS[ch] + 12), 0.9), t0, .22)
    # 퍼커션
    for i in range(16):
        tt = t0 + i * BEAT / 4
        if muted(tt) or tt >= 29.0:
            continue
        if section != 'intro' and i % 8 == 0:
            put(kick(), tt, .5)
        if section != 'intro' and i in (4, 12):
            put(snap(), tt, .16, pan=.1)
        if (section == 'busy') or (section == 'full' and i % 2 == 0) or (section == 'intro' and i % 4 == 2):
            put(shaker(), tt, .10 if i % 2 else .06, pan=.35)
    # 글로켄 멜로디 (풀 편성에서만)
    if section == 'full' and t0 < 28:
        mel = MEL_A if (b // 2) % 2 == 0 else MEL_B
        if b % 2 == 0:
            for beat, m, ln in mel:
                tt = t0 + beat * BEAT
                if tt < 28.9:
                    put(bell(midi(m), 0.4 + ln * .4, .25 + ln * .12), tt, .09, pan=.35)

# 엔딩 화음
for k, m in enumerate([60, 64, 67, 72]):
    put(pluck(midi(m), 2.5, .7, .998), 29.0 + k * .02, .2, pan=-.2 + k * .1)
put(bass_note(midi(36), 1.2), 29.0, .35)
put(bell(midi(84), 1.2, .5), 29.05, .1, pan=.3)

# 바쁨 구간 시계 째깍째깍 (Scene 1 후반)
for i in range(8):
    tt = 2.0 + i * 0.25
    put(bp(rng.uniform(-1, 1, 600), 2500, 6000) * np.exp(-np.arange(600) / 90), tt, .12, pan=-.4)


# ---------------- 효과음 ----------------
def sfx_boing():   # 뿅!
    n = int(.26 * SR); t = np.arange(n) / SR
    f = 320 * np.exp(np.minimum(t, .1) / .1 * np.log(3.6)) * (1 + .03 * np.sin(2 * np.pi * 22 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, .004, .12, .3, .08) * .9


def sfx_pop():     # 팝!
    n = int(.12 * SR); t = np.arange(n) / SR
    f = 260 + 900 * np.exp(-t * 60)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38)
    return s + bp(rng.uniform(-1, 1, n), 1500, 6000) * np.exp(-t * 200) * .4


def sfx_tick():
    n = int(.06 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) * .7 + bp(rng.uniform(-1, 1, n), 2000, 5000) * .4) * np.exp(-t * 90)


def sweep_noise(dur, f0, f1, f2, q=1.0):
    """중심주파수가 f0→f1→f2 로 움직이는 필터드 노이즈 (짧은 청크 오버랩)."""
    n = int(dur * SR); x = rng.uniform(-1, 1, n); out = np.zeros(n)
    hop = 1024; win = np.hanning(hop * 2)
    for s in range(0, n, hop):
        p = s / n
        fc = f0 * (f1 / f0) ** (p * 2) if p < .5 else f1 * (f2 / f1) ** ((p - .5) * 2)
        seg = x[s:s + hop * 2]
        if len(seg) < 32:
            break
        y = bp(seg, max(60, fc / (1 + q)), min(SR / 2 - 100, fc * (1 + q)))
        out[s:s + len(y)] += y * win[:len(y)]
    return out


def sfx_whoosh():  # 부드러운 전환 슉
    n = int(.5 * SR); t = np.arange(n) / SR
    return sweep_noise(.5, 500, 2600, 900) * np.sin(np.pi * t / .5) ** 1.5 * 1.3


def sfx_swoosh():  # 슝! (자동차가 가로지름)
    n = int(.8 * SR); t = np.arange(n) / SR
    e = np.exp(-((t - .32) / .17) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(180 + 160 * np.tanh((t - .32) * 8) * -1 + 160) / SR) * .25
    return (sweep_noise(.8, 400, 3200, 700, .7) * 1.6 + tone) * e


def sfx_shutter():  # 찰칵!
    n = int(.22 * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for t0, g in [(0, 1.0), (.075, .8)]:
        i = int(t0 * SR); m = int(.035 * SR)
        click = hp(rng.uniform(-1, 1, m), 2500) * np.exp(-np.arange(m) / SR * 160)
        thunk = np.sin(2 * np.pi * 180 * np.arange(m) / SR) * np.exp(-np.arange(m) / SR * 120) * .6
        s[i:i + m] += (click + thunk) * g
    return s


def sfx_sparkle():  # 반짝!
    s = np.zeros(int(1.2 * SR))
    for k, m in enumerate([84, 88, 91, 96, 100]):
        b = bell(midi(m), .9, .3) * (1 - k * .08)
        i = int(k * .055 * SR); s[i:i + len(b)] += b[:len(s) - i]
    return s * .55


def sfx_ding():
    s = np.zeros(int(1.3 * SR))
    for t0, m in [(0, 79), (.14, 84)]:
        b = bell(midi(m), 1.0, .45); i = int(t0 * SR); s[i:i + len(b)] += b[:len(s) - i]
    return s * .6


def sfx_spray():
    n = int(1.3 * SR); t = np.arange(n) / SR
    pulse = .55 + .45 * (np.sin(2 * np.pi * 3.2 * t) > -.3)
    return hp(rng.uniform(-1, 1, n), 3500) * pulse * env_adsr(n, .05, 9, 1, .2) * .35


def sfx_stop():     # 음악 정지 '뿌웅~'
    n = int(.35 * SR); t = np.arange(n) / SR
    f = 520 * np.exp(-t * 5.5)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .25 + np.sin(2 * np.pi * np.cumsum(f) / SR) * .5
    return lp(s, 2500) * env_adsr(n, .005, .4, .6, .08)


SFX = {'boing': sfx_boing, 'pop': sfx_pop, 'tick': sfx_tick, 'whoosh': sfx_whoosh, 'swoosh': sfx_swoosh,
       'shutter': sfx_shutter, 'sparkle': sfx_sparkle, 'ding': sfx_ding, 'spray': sfx_spray, 'stop': sfx_stop}
SFX_GAIN = .42

with open(CUES) as fh:
    cues = json.load(fh)
for t, kind, vol in cues:
    put(SFX[kind](), t, SFX_GAIN * vol, pan=float(rng.uniform(-.15, .15)))

# ---------------- 마스터 ----------------
mix = np.stack([L_ch[:N], R_ch[:N]], 1)
fade = int(.6 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
mix[:int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)                   # 소프트 리미터
mix *= 0.89 / np.max(np.abs(mix))                          # -1 dBFS
pcm = (mix * 32767).astype('<i2')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio →', OUT, f'({DUR:.0f}s, {len(cues)} sfx)')
