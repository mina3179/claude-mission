#!/usr/bin/env python3
"""OOM AESTHETIC 30초 세로(1080x1920) 홍보 영상 합성기.

AI 실사 클립(clips/s1..s5.mp4) 위에 자막·진단 UI·로고 애니메이션을 Pillow로
그리고, ffmpeg로 인코딩한 뒤 music.wav를 입힙니다.
클립이 없으면 키프레임 이미지(keyframes/s*.png)를 천천히 줌하는 것으로 대체합니다.

    python3 compose.py [out.mp4] [--preview]
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
FPS = 30
DUR = 30.0
NF = int(DUR * FPS)

COCOA = (74, 52, 46)
ROSE = (190, 128, 120)
GOLD = (184, 150, 98)
GOLD_L = (222, 196, 150)
IVORY = (248, 242, 234)

SERIF_KR = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
SERIF_KR_B = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
SANS_KR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
CORM = os.path.join(HERE, "fonts", "Cormorant.ttf")

_font_cache = {}


def font(path, size, index=1, var=None):
    key = (path, size, index, var)
    if key not in _font_cache:
        if path.endswith(".ttc"):
            f = ImageFont.truetype(path, size, index=index)
        else:
            f = ImageFont.truetype(path, size)
            if var:
                f.set_variation_by_name(var)
        _font_cache[key] = f
    return _font_cache[key]


# ---------- easing ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo3(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eio(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def eob(t, s=1.6):
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


# ---------- 배경 클립 ----------
SCENES = [  # (시작, 끝)
    (0.0, 5.0), (5.0, 10.0), (10.0, 15.0), (15.0, 20.0), (20.0, 25.0),
]
XFADE = 0.45
END_START = 24.7  # 엔드카드 크로스페이드 시작


class Clip:
    def __init__(self, idx):
        self.idx = idx
        self.frames = []
        d = os.path.join(HERE, "work", f"s{idx}")
        mp4 = os.path.join(HERE, "clips", f"s{idx}.mp4")
        if os.path.exists(mp4):
            os.makedirs(d, exist_ok=True)
            if not os.listdir(d):
                subprocess.run([
                    "ffmpeg", "-v", "error", "-y", "-i", mp4,
                    "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},unsharp=5:5:0.35",
                    "-q:v", "2", os.path.join(d, "%04d.jpg")], check=True)
            self.frames = sorted(os.path.join(d, f) for f in os.listdir(d))
        self.still = None
        if not self.frames:
            img = Image.open(os.path.join(HERE, "keyframes", f"s{idx}.png")).convert("RGB")
            self.still = img.resize((W, H), Image.LANCZOS)
        self._cache = (None, None)

    def get(self, lt):
        """lt: 클립 내부 시간(초)."""
        if self.frames:
            i = int(round(lt * FPS))
            i = max(0, min(len(self.frames) - 1, i))
            if self._cache[0] != i:
                self._cache = (i, Image.open(self.frames[i]).convert("RGB"))
            return self._cache[1]
        z = 1.0 + 0.06 * clamp(lt / 5.0)
        w2, h2 = int(W / z), int(H / z)
        x0, y0 = (W - w2) // 2, (H - h2) // 2
        return self.still.crop((x0, y0, x0 + w2, y0 + h2)).resize((W, H), Image.BILINEAR)


# ---------- 엔드카드 배경 ----------
def make_end_bg():
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.44) / H) ** 2)
    g = np.clip(1 - d * 1.6, 0, 1)[..., None]
    base = np.array(IVORY, float)
    warm = np.array((252, 236, 224), float)
    edge = np.array((236, 224, 212), float)
    arr = edge + (base - edge) * np.clip(1 - d * 1.1, 0, 1)[..., None]
    arr = arr + (warm - arr) * g * 0.6
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


# ---------- 공통 그리기 ----------
def text_w(f, s, tracking=0):
    return sum(f.getlength(c) for c in s) + tracking * (len(s) - 1)


def draw_chars(layer, s, cx, y, f, color, t, t_in, t_out=None, stagger=0.035,
               rise=26, tracking=0, alpha=1.0, glow=None):
    """글자별 페이드-업 등장. layer는 RGBA. y는 글자 윗선."""
    total = text_w(f, s, tracking)
    x = cx - total / 2
    out_k = 1.0
    out_dy = 0
    if t_out is not None:
        k = eio((t - t_out) / 0.45)
        out_k = 1 - k
        out_dy = -18 * k
    if out_k <= 0:
        return
    d = ImageDraw.Draw(layer)
    for i, c in enumerate(s):
        p = eo3((t - t_in - i * stagger) / 0.55)
        if p > 0 and c != " ":
            a = int(255 * p * out_k * alpha)
            d.text((x, y + rise * (1 - p) + out_dy), c, font=f, fill=color + (a,))
        x += f.getlength(c) + tracking


def soft_plate(base, y0, y1, strength=0.78):
    """하단 자막 가독성을 위한 아이보리 그라디언트."""
    arr = np.asarray(base).astype(np.float32)
    ys = np.arange(H, dtype=np.float32)
    k = np.clip((ys - y0) / (y1 - y0), 0, 1)
    k = (k * k * (3 - 2 * k)) * strength
    arr = arr + (np.array(IVORY, np.float32) - arr) * k[:, None, None]
    return Image.fromarray(arr.astype(np.uint8))


def ring_patch(radius, width, frac, color, alpha=255, start=-90, ss=4, dot=0.0):
    """안티에일리어싱된 원호(진행률 frac) 패치."""
    size = int((radius + width + 4) * 2)
    big = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    c = size * ss / 2
    r = radius * ss
    if frac > 0:
        d.arc((c - r, c - r, c + r, c + r), start, start + 360 * clamp(frac),
              fill=color + (alpha,), width=int(width * ss))
    if dot > 0:
        rd = dot * ss
        d.ellipse((c - rd, c - rd, c + rd, c + rd), fill=color + (alpha,))
    return big.resize((size, size), Image.LANCZOS)


def paste_center(layer, patch, cx, cy):
    layer.alpha_composite(patch, (int(cx - patch.width / 2), int(cy - patch.height / 2)))


def brand_mark(layer, t):
    """상단 작은 브랜드 표기 (0.4~24.6s)."""
    a = eio((t - 0.4) / 0.8) * (1 - eio((t - 24.2) / 0.5))
    if a <= 0:
        return
    f = font(CORM, 34, var=b"SemiBold")
    s = "OOM  AESTHETIC"
    tw = text_w(f, s, 7)
    ring = ring_patch(11, 2.0, 1.0, GOLD, int(230 * a), dot=2.4)
    x0 = W / 2 - (tw + 34) / 2
    paste_center(layer, ring, x0 + 11, 118)
    txt = Image.new("RGBA", (W, 80), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    x = x0 + 34
    for c in s:
        td.text((x, 16), c, font=f, fill=COCOA + (int(240 * a),))
        x += f.getlength(c) + 7
    halo = Image.new("RGBA", (W, 80), IVORY + (0,))
    halo.putalpha(txt.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda v: min(255, v * 2)))
    layer.alpha_composite(halo, (0, 80))
    layer.alpha_composite(txt, (0, 80))


def step_label(layer, t, t_in, t_out, num, name, y):
    a = eio((t - t_in) / 0.5) * (1 - eio((t - t_out) / 0.4))
    if a <= 0:
        return
    f = font(CORM, 34, var=b"SemiBold")
    s = f"STEP {num}   ·   {name}"
    tw = text_w(f, s, 5)
    d = ImageDraw.Draw(layer)
    x = W / 2 - tw / 2
    for c in s:
        d.text((x, y), c, font=f, fill=ROSE + (int(255 * a),))
        x += f.getlength(c) + 5
    # 양옆 골드 라인
    L = 70 * eo3((t - t_in) / 0.7)
    d.line((W / 2 - tw / 2 - 24 - L, y + 22, W / 2 - tw / 2 - 24, y + 22), fill=GOLD + (int(220 * a),), width=2)
    d.line((W / 2 + tw / 2 + 24, y + 22, W / 2 + tw / 2 + 24 + L, y + 22), fill=GOLD + (int(220 * a),), width=2)


# ---------- 장면별 오버레이 ----------
def ov_s1(layer, t):
    f = font(SERIF_KR, 62)
    fb = font(SERIF_KR_B, 74)
    draw_chars(layer, "같은 관리,", W / 2, 1500, f, COCOA, t, 0.6, 4.45)
    draw_chars(layer, "왜 나한테만 안 맞을까?", W / 2, 1600, fb, COCOA, t, 1.2, 4.45)


def pill(layer, cx, cy, label, value, p, side):
    if p <= 0:
        return
    s = eob(p)
    fl = font(SANS_KR, 30)
    fv = font(SERIF_KR_B, 40)
    lw = fl.getlength(label)
    vw = fv.getlength(value)
    bw, bh = lw + vw + 78, 78
    big = Image.new("RGBA", (int(bw) + 8, bh + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle((4, 4, bw + 4, bh + 4), radius=39, fill=IVORY + (225,), outline=GOLD + (255,), width=2)
    d.ellipse((26, bh / 2 - 3, 36, bh / 2 + 7), fill=ROSE + (255,))
    d.text((48, bh / 2 - 16), label, font=fl, fill=COCOA + (200,))
    d.text((48 + lw + 14, bh / 2 - 22), value, font=fv, fill=COCOA + (255,))
    a = clamp(p * 2.5)
    if a < 1:
        big.putalpha(big.getchannel("A").point(lambda v: int(v * a)))
    sw, sh = max(1, int(big.width * s)), max(1, int(big.height * s))
    big = big.resize((sw, sh), Image.LANCZOS)
    # 리더 라인
    d2 = ImageDraw.Draw(layer)
    lx = cx + (bw / 2 if side == "l" else -bw / 2)
    tx = lx + (70 if side == "l" else -70)
    d2.line((lx, cy, tx, cy), fill=GOLD + (int(230 * a),), width=2)
    d2.ellipse((tx - 6, cy - 6, tx + 6, cy + 6), outline=GOLD + (int(255 * a),), width=2)
    layer.alpha_composite(big, (int(cx - sw / 2), int(cy - sh / 2)))


def ov_s2(layer, t):
    lt = t - 5.0
    out = 1 - eio((t - 9.55) / 0.4)
    d = ImageDraw.Draw(layer)
    # 코너 브래킷
    a = eio((lt - 0.2) / 0.5) * out
    if a > 0:
        m, L = 70, 70
        x0, y0, x1, y1 = m, 250, W - m, 1300
        col = GOLD + (int(230 * a),)
        for (x, y, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            d.line((x, y, x + sx * L, y), fill=col, width=3)
            d.line((x, y, x, y + sy * L), fill=col, width=3)
    # 스캔 라인
    p = (lt - 0.3) / 1.6
    if 0 < p < 1:
        y = 200 + (1290 - 200) * eio(p)
        k = math.sin(math.pi * p)
        band = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        for i in range(160):
            bd.line((0, i, W, i), fill=GOLD_L + (int(70 * k * (i / 160) ** 2),))
        layer.alpha_composite(band, (0, int(y - 160)))
        d.line((60, y, W - 60, y), fill=(255, 236, 200, int(255 * k)), width=3)
    # 데이터 태그
    pill(layer, 230, 560, "유분", "32%", clamp((lt - 1.0) / 0.45) * out, "l")
    pill(layer, W - 240, 820, "수분", "48%", clamp((lt - 1.6) / 0.45) * out, "r")
    pill(layer, 250, 1060, "민감도", "●●○", clamp((lt - 2.2) / 0.45) * out, "l")
    # 도장
    ps = (lt - 3.0) / 0.35
    if ps > 0 and out > 0:
        sc = 1.35 - 0.35 * eo3(ps)
        a = clamp(ps * 1.5) * out
        f1 = font(CORM, 30, var=b"Bold")
        f2 = font(SERIF_KR_B, 50)
        txt = "수분부족 지성"
        bw = max(f2.getlength(txt), 260) + 80
        bh = 150
        st = Image.new("RGBA", (int(bw) + 10, bh + 10), (0, 0, 0, 0))
        sd = ImageDraw.Draw(st)
        sd.rounded_rectangle((5, 5, bw + 5, bh + 5), radius=16, outline=ROSE + (255,), width=4, fill=(255, 250, 246, 150))
        sd.rounded_rectangle((13, 13, bw - 3, bh - 3), radius=11, outline=ROSE + (150,), width=1)
        s1 = "YOUR SKIN TYPE"
        w1 = text_w(f1, s1, 4)
        x = (bw + 10) / 2 - w1 / 2
        for c in s1:
            sd.text((x, 26), c, font=f1, fill=ROSE + (255,))
            x += f1.getlength(c) + 4
        sd.text(((bw + 10) / 2 - f2.getlength(txt) / 2, 66), txt, font=f2, fill=ROSE + (255,))
        st = st.rotate(-5, resample=Image.BICUBIC, expand=True)
        st = st.resize((int(st.width * sc), int(st.height * sc)), Image.LANCZOS)
        st.putalpha(st.getchannel("A").point(lambda v: int(v * a)))
        layer.alpha_composite(st, (int(W / 2 - st.width / 2), int(1330 - st.height / 2)))
    # 자막
    step_label(layer, t, 5.35, 9.55, "01", "DIAGNOSIS", 1452)
    f = font(SERIF_KR_B, 70)
    draw_chars(layer, "피부 타입부터", W / 2, 1530, f, COCOA, t, 5.5, 9.55)
    draw_chars(layer, "정확하게 진단하고", W / 2, 1630, f, COCOA, t, 6.0, 9.55)


def ov_s3(layer, t):
    lt = t - 10.0
    out = 1 - eio((t - 14.55) / 0.4)
    # 체크 링
    p = (lt - 1.4) / 0.6
    if p > 0 and out > 0:
        cx, cy = W / 2, 1335
        ring = ring_patch(44, 3, eo3(p), GOLD, int(255 * out))
        paste_center(layer, ring, cx, cy)
        q = eo3((lt - 1.9) / 0.35)
        if q > 0:
            ss = 4
            size = 120
            big = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
            bd = ImageDraw.Draw(big)
            pts = [(38, 62), (54, 77), (84, 44)]
            seg1 = clamp(q / 0.4)
            seg2 = clamp((q - 0.4) / 0.6)
            ax, ay = pts[0]
            bx, by = ax + (pts[1][0] - ax) * seg1, ay + (pts[1][1] - ay) * seg1
            bd.line((ax * ss, ay * ss, bx * ss, by * ss), fill=GOLD + (int(255 * out),), width=5 * ss)
            if seg2 > 0:
                cx2 = pts[1][0] + (pts[2][0] - pts[1][0]) * seg2
                cy2 = pts[1][1] + (pts[2][1] - pts[1][1]) * seg2
                bd.line((pts[1][0] * ss, pts[1][1] * ss, cx2 * ss, cy2 * ss), fill=GOLD + (int(255 * out),), width=5 * ss)
            big = big.resize((size, size), Image.LANCZOS)
            paste_center(layer, big, cx, cy)
    step_label(layer, t, 10.35, 14.55, "02", "SELECTION", 1412)
    f = font(SERIF_KR_B, 70)
    draw_chars(layer, "나에게 맞는 관리만", W / 2, 1490, f, COCOA, t, 10.5, 14.55)
    draw_chars(layer, "골라서", W / 2, 1590, f, COCOA, t, 11.1, 14.55)


SPARKS = [(np.random.default_rng(3).random(), ) for _ in range(1)]
_rng = np.random.default_rng(11)
SPARK_POS = [(_rng.uniform(120, W - 120), _rng.uniform(260, 1250), _rng.uniform(0, 4), _rng.uniform(10, 24)) for _ in range(26)]


def sparkle(layer, x, y, r, a):
    if a <= 0:
        return
    size = int(r * 4)
    ss = 3
    big = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    c = size * ss / 2
    R = r * ss
    w = R * 0.16
    col = (255, 248, 230, int(255 * a))
    d.polygon([(c, c - R), (c + w, c - w), (c + R, c), (c + w, c + w), (c, c + R), (c - w, c + w), (c - R, c), (c - w, c - w)], fill=col)
    big = big.resize((size, size), Image.LANCZOS)
    glow = big.filter(ImageFilter.GaussianBlur(r * 0.5))
    layer.alpha_composite(glow, (int(x - size / 2), int(y - size / 2)))
    layer.alpha_composite(big, (int(x - size / 2), int(y - size / 2)))


def ov_s4(layer, t):
    lt = t - 15.0
    out = 1 - eio((t - 19.55) / 0.4)
    for (x, y, ph, r) in SPARK_POS:
        a = max(0, math.sin((lt * 1.6 + ph) * math.pi / 2)) ** 3 * eio((lt - 0.8) / 0.8) * out
        sparkle(layer, x, y, r, a * 0.9)
    step_label(layer, t, 15.35, 19.55, "03", "PREMIUM CARE", 1412)
    fs = font(SERIF_KR, 50)
    draw_chars(layer, "나에게 맞는 관리만 골라서", W / 2, 1500, fs, ROSE, t, 15.5, 19.55, stagger=0.02)
    fb = font(SERIF_KR_B, 112)
    draw_chars(layer, "해드립니다", W / 2, 1580, fb, COCOA, t, 16.1, 19.55, stagger=0.09, rise=40)


def ov_s5(layer, t):
    lt = t - 20.0
    out = 1 - eio((t - 24.5) / 0.4)
    if out <= 0:
        return
    # 16 카운트업
    p = eo3((lt - 0.4) / 1.6)
    if lt > 0.3:
        n = max(1, int(round(1 + 15 * p)))
        a = eio((lt - 0.3) / 0.4) * out
        fnum = font(CORM, 300, var=b"Medium")
        s = str(n)
        tw = fnum.getlength(s, features=["lnum"])
        num = Image.new("RGBA", (W, 380), (0, 0, 0, 0))
        nd = ImageDraw.Draw(num)
        nd.text((W / 2 - tw / 2, 0), s, font=fnum, fill=(255, 255, 255, 255), features=["lnum"])
        # 골드 그라디언트 채우기
        grad = np.zeros((380, W, 4), np.uint8)
        g0, g1 = np.array((206, 170, 112)), np.array((150, 112, 66))
        for i in range(380):
            grad[i, :, :3] = g0 + (g1 - g0) * (i / 380)
        grad[..., 3] = (np.asarray(num.getchannel("A")).astype(np.float32) * a).astype(np.uint8)
        gi = Image.fromarray(grad, "RGBA")
        layer.alpha_composite(gi, (0, 215))
    fy = font(CORM, 46, var=b"SemiBold")
    draw_chars(layer, "YEARS OF EXPERTISE", W / 2, 600, fy, COCOA, t, 21.6, 24.5, stagger=0.02, tracking=10)
    # 하단 자막
    f = font(SERIF_KR_B, 70)
    fs = font(CORM, 44, var=b"SemiBold")
    draw_chars(layer, "16년의 노하우로 완성하는", W / 2, 1500, font(SERIF_KR, 58), COCOA, t, 22.0, 24.5, stagger=0.025)
    draw_chars(layer, "프리미엄 케어", W / 2, 1590, f, COCOA, t, 22.5, 24.5)
    draw_chars(layer, "PREMIUM SKIN CARE", W / 2, 1705, fs, ROSE, t, 22.9, 24.5, stagger=0.02, tracking=9)


def ov_end(layer, t):
    lt = t - 25.0
    d = ImageDraw.Draw(layer)
    cy = 760
    # 로고: O ◎ M
    fo = font(CORM, 190, var=b"Medium")
    oW = fo.getlength("O")
    mW = fo.getlength("M")
    ring_r = 70
    gap = 26
    total = oW + gap + ring_r * 2 + gap + mW
    x0 = W / 2 - total / 2
    # 링(진단 렌즈)이 먼저 그려짐 → 26.0s 완성
    rp = eio((lt - 0.2) / 0.8)
    if rp > 0:
        ring = ring_patch(ring_r, 5, rp, GOLD, 255, dot=8 * eob((lt - 0.95) / 0.4) if lt > 0.95 else 0)
        paste_center(layer, ring, x0 + oW + gap + ring_r, cy)
    # O, M
    a = eo3((lt - 0.9) / 0.6)
    if a > 0:
        bb = fo.getbbox("O")
        ty = cy - (bb[1] + bb[3]) / 2
        dx = 30 * (1 - a)
        d.text((x0 - dx, ty), "O", font=fo, fill=COCOA + (int(255 * a),))
        d.text((x0 + oW + gap * 2 + ring_r * 2 + dx, ty), "M", font=fo, fill=COCOA + (int(255 * a),))
    # AESTHETIC
    fa = font(CORM, 54, var=b"SemiBold")
    draw_chars(layer, "AESTHETIC", W / 2, cy + 120, fa, COCOA, t, 26.2, stagger=0.04, tracking=22, rise=16)
    # 골드 디바이더
    L = 150 * eo3((lt - 1.6) / 0.7)
    if L > 0:
        d.line((W / 2 - L, cy + 230, W / 2 + L, cy + 230), fill=GOLD + (230,), width=2)
    fk = font(SERIF_KR, 46)
    draw_chars(layer, "옴 에 스 테 틱", W / 2, cy + 262, fk, COCOA, t, 26.9, stagger=0.05, rise=14)
    # 슬로건
    fsl = font(SERIF_KR_B, 64)
    draw_chars(layer, "당신의 피부를 먼저 읽습니다", W / 2, 1380, fsl, COCOA, t, 27.4, stagger=0.045)
    fy = font(CORM, 38, var=b"SemiBold")
    draw_chars(layer, "16 YEARS  ·  PREMIUM SKIN CARE", W / 2, 1500, fy, ROSE, t, 28.1, stagger=0.015, tracking=6, rise=10)


def render_frame(fi, clips, end_bg, bokeh):
    t = fi / FPS
    # 배경
    if t < END_START + 0.6:
        idx = min(4, int(t // 5))
        base = clips[idx].get(t - SCENES[idx][0] + 0.15)
        # 다음 장면과 디졸브
        nxt = idx + 1
        if nxt < 5:
            bt = SCENES[nxt][0]
            k = (t - (bt - XFADE / 2)) / XFADE
            if k > 0:
                nb = clips[nxt].get(max(0, t - bt + 0.15))
                base = Image.blend(base, nb, eio(k))
        prev_t = t - 5 * idx
        if idx > 0 and prev_t < XFADE / 2:
            pb = clips[idx - 1].get(5.0)
            base = Image.blend(pb, base, eio(0.5 + prev_t / XFADE))
    else:
        base = None
    # 엔드카드
    ek = eio((t - END_START) / 0.6)
    if ek > 0:
        eb = end_bg.copy()
        eb = Image.alpha_composite(eb.convert("RGBA"), bokeh_layer(bokeh, t)).convert("RGB")
        base = eb if base is None or ek >= 1 else Image.blend(base, eb, ek)
    # 처음 페이드 인
    if t < 0.5:
        base = Image.blend(Image.new("RGB", (W, H), IVORY), base, eio(t / 0.5))

    # 자막 가독성 플레이트 (영상 구간)
    if t < END_START + 0.3:
        plate_k = 1 - ek
        if plate_k > 0:
            plated = soft_plate(base, 1150, 1560, 0.82)
            base = Image.blend(base, plated, plate_k)
        if 20.0 <= t < 25.0:  # 16 숫자 영역 상단도 살짝 밝게
            arr = np.asarray(base).astype(np.float32)
            ys = np.arange(H, dtype=np.float32)
            k = np.clip(1 - (ys - 560) / 260, 0, 1) * 0.35 * eio((t - 20.2) / 0.5) * (1 - ek)
            arr = arr + (np.array(IVORY, np.float32) - arr) * k[:, None, None]
            base = Image.fromarray(arr.astype(np.uint8))

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    brand_mark(layer, t)
    if t < 5.0:
        ov_s1(layer, t)
    elif t < 10.0:
        ov_s2(layer, t)
    elif t < 15.0:
        ov_s3(layer, t)
    elif t < 20.0:
        ov_s4(layer, t)
    elif t < 25.0:
        ov_s5(layer, t)
    if t >= 25.0:
        ov_end(layer, t)
    out = Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")
    # 마지막 페이드
    if t > DUR - 0.5:
        out = Image.blend(out, Image.new("RGB", (W, H), IVORY), eio((t - (DUR - 0.5)) / 0.5) * 0.0)
    return out


def make_bokeh():
    r = np.random.default_rng(5)
    return [(r.uniform(0, W), r.uniform(0, H), r.uniform(30, 110), r.uniform(0.2, 0.6), r.uniform(0, 6.28)) for _ in range(16)]


def bokeh_layer(bokeh, t):
    lay = Image.new("RGBA", (W // 4, H // 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for (x, y, r, sp, ph) in bokeh:
        yy = (y - t * 22 * sp) % H
        xx = x + 20 * math.sin(t * 0.5 + ph)
        a = int(16 + 10 * math.sin(t * 1.2 + ph))
        col = (236, 200, 180, a) if ph > 3 else (230, 205, 160, a)
        d.ellipse(((xx - r) / 4, (yy - r) / 4, (xx + r) / 4, (yy + r) / 4), fill=col)
    lay = lay.filter(ImageFilter.GaussianBlur(9))
    return lay.resize((W, H), Image.BILINEAR)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else os.path.join(HERE, "oom_aesthetic_30s.mp4")
    preview = "--preview" in sys.argv
    clips = [Clip(i) for i in range(1, 6)]
    end_bg = make_end_bg()
    bokeh = make_bokeh()
    if preview:
        os.makedirs(os.path.join(HERE, "work", "preview"), exist_ok=True)
        for tt in (2.6, 6.2, 8.6, 12.6, 17.8, 22.8, 26.3, 29.0):
            render_frame(int(tt * FPS), clips, end_bg, bokeh).save(os.path.join(HERE, "work", "preview", f"t{tt:05.1f}.jpg"), quality=88)
        return
    music = os.path.join(HERE, "music.wav")
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", music,
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(NF):
        proc.stdin.write(render_frame(fi, clips, end_bg, bokeh).tobytes())
        if fi % 90 == 0:
            print(f"frame {fi}/{NF}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
