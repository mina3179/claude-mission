#!/usr/bin/env python3
"""5초짜리 자막 모션그래픽 MP4 생성기.

Pillow로 프레임을 그려 ffmpeg(libx264)로 인코딩합니다.

    python3 motion_subtitle.py [출력경로.mp4]

필요: Python 3, Pillow, numpy, ffmpeg, 한글 폰트(기본: 나눔스퀘어 / fonts-nanum)
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
DURATION = 5.0
FRAMES = int(FPS * DURATION)

FONT_DIR = os.environ.get("FONT_DIR", "/usr/share/fonts/truetype/nanum")
FONT_BOLD = os.path.join(FONT_DIR, "NanumSquareEB.ttf")
FONT_REG = os.path.join(FONT_DIR, "NanumSquareR.ttf")
if not os.path.exists(FONT_BOLD):
    FONT_BOLD = os.path.join(FONT_DIR, "NanumSquareB.ttf")

ACCENT = (255, 122, 69)      # 코랄 오렌지
ACCENT2 = (120, 140, 255)    # 라벤더 블루
WHITE = (245, 245, 250)

# (시작, 끝, 메인 자막, 보조 자막)
CUES = [
    (0.15, 2.50, "작은 아이디어가", "Every big change"),
    (2.55, 4.85, "큰 변화를 만듭니다", "starts with a small idea"),
]


# ---------- easing ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out_cubic(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    t = clamp(t)
    return t ** 3


def ease_out_back(t, s=1.7):
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def ease_in_out(t):
    t = clamp(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


# ---------- 배경 ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
nx, ny = xx / W, yy / H
rng = np.random.default_rng(7)
PARTICLES = [
    (rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1.0, 3.2),
     rng.uniform(-18, 18), rng.uniform(-40, -10), rng.uniform(0, 6.28))
    for _ in range(70)
]


def background(t):
    # 천천히 움직이는 두 개의 컬러 글로우 + 짙은 남색 베이스
    base = np.empty((H, W, 3), np.float32)
    base[..., 0] = 10 + 8 * ny
    base[..., 1] = 12 + 6 * ny
    base[..., 2] = 26 + 14 * ny

    cx1 = 0.28 + 0.06 * math.sin(t * 0.9)
    cy1 = 0.35 + 0.05 * math.cos(t * 0.7)
    cx2 = 0.74 + 0.05 * math.cos(t * 0.8)
    cy2 = 0.66 + 0.06 * math.sin(t * 1.1)
    g1 = np.exp(-(((nx - cx1) * 1.6) ** 2 + (ny - cy1) ** 2) / 0.06)
    g2 = np.exp(-(((nx - cx2) * 1.6) ** 2 + (ny - cy2) ** 2) / 0.07)
    for c in range(3):
        base[..., c] += g1 * ACCENT2[c] * 0.30 + g2 * ACCENT[c] * 0.22

    # 비네팅
    v = 1 - 0.55 * (((nx - 0.5) * 1.3) ** 2 + ((ny - 0.5) * 1.6) ** 2)
    base *= v[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")

    # 떠오르는 입자
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (x0, y0, r, vx, vy, ph) in PARTICLES:
        x = (x0 + vx * t) % W
        y = (y0 + vy * t) % H
        a = int(70 + 60 * math.sin(ph + t * 2.0))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))
    img = img.convert("RGBA")
    img.alpha_composite(layer)
    return img


# ---------- 텍스트 ----------
font_main = ImageFont.truetype(FONT_BOLD, 120)
font_sub = ImageFont.truetype(FONT_REG, 44)
font_tag = ImageFont.truetype(FONT_BOLD, 28)


def char_positions(text, font):
    """자간(커닝)을 유지하도록 접두사 길이로 각 글자의 x 위치 계산."""
    xs = [font.getlength(text[:i]) for i in range(len(text))]
    return xs, font.getlength(text)


def draw_cue(canvas, t, start, end, main, sub, cy):
    if t < start - 0.01 or t > end + 0.01:
        return
    local = t - start
    span = end - start
    out = ease_in_cubic((local - (span - 0.45)) / 0.45)  # 퇴장 진행도

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # 1) 하이라이트 바: 왼쪽→오른쪽으로 펼쳐지고, 퇴장 시 오른쪽으로 걷힘
    xs, total = char_positions(main, font_main)
    x0 = (W - total) / 2
    pad = 36
    bar_in = ease_out_cubic(local / 0.5)
    left = x0 - pad + (total + 2 * pad) * ease_in_out(out)
    right = x0 - pad + (total + 2 * pad) * bar_in
    if right > left:
        d.rounded_rectangle([left, cy + 58, right, cy + 74], radius=8,
                            fill=ACCENT + (235,))

    # 2) 메인 자막: 글자별로 아래에서 튀어오르며 등장
    for i, ch in enumerate(main):
        if ch == " ":
            continue
        ct = (local - 0.08 - i * 0.045) / 0.42
        p = ease_out_back(ct)
        a = clamp(ct * 1.6) * (1 - out)
        if a <= 0:
            continue
        dy = (1 - p) * 70 - out * 40
        alpha = int(255 * a)
        d.text((x0 + xs[i], cy - 70 + dy), ch, font=font_main,
               fill=WHITE + (alpha,))

    # 3) 보조(영문) 자막: 살짝 늦게 페이드업
    st = ease_out_cubic((local - 0.45) / 0.5)
    sa = int(200 * st * (1 - out))
    if sa > 0:
        sw = font_sub.getlength(sub)
        d.text(((W - sw) / 2, cy + 108 + (1 - st) * 24), sub, font=font_sub,
               fill=(210, 214, 235, sa))

    # 글로우: 블러된 사본을 먼저 깔아 은은한 빛 번짐
    glow = layer.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(layer)


def draw_chrome(canvas, t):
    """상단 태그와 하단 진행 바."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    a = ease_out_cubic(t / 0.6) * (1 - ease_in_cubic((t - 4.6) / 0.4))
    if a > 0:
        tag = "CLAUDE MISSION"
        tw = font_tag.getlength(tag)
        x = (W - tw) / 2
        y = 150 - (1 - a) * 20
        d.rounded_rectangle([x - 22, y - 12, x + tw + 22, y + 44], radius=28,
                            outline=(255, 255, 255, int(120 * a)), width=2)
        d.text((x, y), tag, font=font_tag, fill=(255, 255, 255, int(220 * a)))

    # 진행 바
    prog = clamp(t / DURATION)
    d.rectangle([0, H - 8, W, H], fill=(255, 255, 255, 25))
    d.rectangle([0, H - 8, W * prog, H], fill=ACCENT2 + (220,))
    canvas.alpha_composite(layer)


def render_frame(i):
    t = i / FPS
    canvas = background(t)
    draw_chrome(canvas, t)
    for start, end, main, sub in CUES:
        draw_cue(canvas, t, start, end, main, sub, cy=H // 2 + 20)
    # 전체 페이드 인/아웃
    fade = ease_out_cubic(t / 0.25) * (1 - ease_in_cubic((t - 4.75) / 0.25))
    frame = canvas.convert("RGB")
    if fade < 1:
        frame = Image.blend(Image.new("RGB", (W, H)), frame, fade)
    return frame


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "subtitle_motion.mp4"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
        "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(FRAMES):
        proc.stdin.write(render_frame(i).tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        sys.exit(proc.returncode)
    print(f"wrote {out} ({FRAMES} frames, {DURATION}s @ {FPS}fps, {W}x{H})")


if __name__ == "__main__":
    main()
