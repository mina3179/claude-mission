#!/usr/bin/env python3
"""김해 테크노자동차정비 홍보 모션그래픽 (9:16, 1080×1920, 30fps, 30초).

블랙 & 골드 톤. Pillow로 프레임을 그리고 ffmpeg(libx264)로 인코딩합니다.
배경 사진(assets/techno/img*.jpg)은 Higgsfield(GPT Image 2.6)로 생성한 이미지,
배경음악은 techno_bgm.py가 합성합니다.

    python3 techno_promo.py [출력.mp4]            # 전체 렌더 (음악 포함)
    python3 techno_promo.py --stills 1.5,4.5 DIR  # 특정 시점 스틸 미리보기

필요: Python 3, Pillow, numpy, scipy, ffmpeg, 나눔 폰트(fonts-nanum)
"""
import math
import os
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 30
DUR = 30.0
NF = int(FPS * DUR)

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets", "techno")
FONT_DIR = os.environ.get("FONT_DIR", "/usr/share/fonts/truetype/nanum")
F_EB = os.path.join(FONT_DIR, "NanumSquare_acEB.ttf")
F_B = os.path.join(FONT_DIR, "NanumSquare_acB.ttf")
F_R = os.path.join(FONT_DIR, "NanumSquare_acR.ttf")
F_SERIF = os.path.join(FONT_DIR, "NanumMyeongjoExtraBold.ttf")
F_MONO = os.path.join(FONT_DIR, "NanumGothicCoding.ttf")

# ---------- 브랜드 컬러: Black & Gold ----------
BLACK = (8, 7, 6)
GOLD = (212, 172, 74)
GOLD_L = (246, 220, 150)
GOLD_D = (130, 92, 30)
WHITE = (246, 242, 234)
GOLD_STOPS = [(0.0, (255, 243, 196)), (0.3, (242, 208, 118)), (0.56, (196, 146, 56)),
              (0.8, (246, 214, 132)), (1.0, (178, 128, 46))]

PHONE = "010-5505-0759"

# 장면: (시작, 끝)
SCENES = [(0.0, 3.0), (3.0, 6.0), (6.0, 11.0), (11.0, 15.0),
          (15.0, 19.0), (19.0, 25.0), (25.0, 27.5), (27.5, 30.0)]
CUTS = [s for s, _ in SCENES[1:]]


# ======================================================================
# 기본 유틸
# ======================================================================
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(t, a, d):
    return clamp((t - a) / d) if d > 0 else float(t >= a)


def eo(t):            # ease-out cubic
    t = clamp(t)
    return 1 - (1 - t) ** 3


def eio(t):           # ease-in-out
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def eback(t, s=1.6):
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def lerp(a, b, t):
    return a + (b - a) * t


@lru_cache(maxsize=None)
def font(path, size):
    return ImageFont.truetype(path, size)


def gold_ramp(h):
    ys = np.linspace(0, 1, max(h, 2))
    out = np.zeros((len(ys), 3))
    for c in range(3):
        out[:, c] = np.interp(ys, [p for p, _ in GOLD_STOPS], [col[c] for _, col in GOLD_STOPS])
    return out


def colorize(mask, style):
    """mask(L) -> RGBA. style: 'gold' | (r,g,b)"""
    w, h = mask.size
    if style == "gold":
        ramp = gold_ramp(h)
        rgb = np.repeat(ramp[:, None, :], w, axis=1).astype(np.uint8)
    else:
        rgb = np.empty((h, w, 3), np.uint8)
        rgb[:] = style
    a = np.asarray(mask)[..., None]
    return Image.fromarray(np.concatenate([rgb, a], axis=2), "RGBA")


def alpha_mul(layer, a):
    if a >= 0.999:
        return layer
    layer = layer.copy()
    al = layer.getchannel("A").point([int(i * a) for i in range(256)])
    layer.putalpha(al)
    return layer


def comp(canvas, layer, x, y):
    """안전한 alpha_composite (음수/화면 밖 좌표 허용)."""
    x, y = int(round(x)), int(round(y))
    lw, lh = layer.size
    cx0, cy0 = max(0, x), max(0, y)
    cx1, cy1 = min(canvas.width, x + lw), min(canvas.height, y + lh)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    if (cx0, cy0, cx1, cy1) != (x, y, x + lw, y + lh):
        layer = layer.crop((cx0 - x, cy0 - y, cx1 - x, cy1 - y))
    canvas.alpha_composite(layer, (cx0, cy0))


def put(canvas, layer, x, y, alpha=1.0, scale=1.0, anchor="mm"):
    if alpha <= 0.004 or layer is None:
        return
    if abs(scale - 1) > 1e-3:
        nw, nh = max(1, int(layer.width * scale)), max(1, int(layer.height * scale))
        layer = layer.resize((nw, nh), Image.BICUBIC)
    layer = alpha_mul(layer, alpha)
    w, h = layer.size
    ox = {"l": 0, "m": w / 2, "r": w}[anchor[0]]
    oy = {"t": 0, "m": h / 2, "b": h}[anchor[1]]
    comp(canvas, layer, x - ox, y - oy)


# ======================================================================
# 텍스트
# ======================================================================
PAD = 40


@lru_cache(maxsize=1024)
def text_mask(text, fpath, size, tracking=0):
    f = font(fpath, size)
    asc, desc = f.getmetrics()
    widths = [f.getlength(ch) for ch in text]
    tw = int(sum(widths) + tracking * max(0, len(text) - 1))
    m = Image.new("L", (tw + PAD * 2, asc + desc + PAD * 2), 0)
    d = ImageDraw.Draw(m)
    x = PAD
    for ch, cw in zip(text, widths):
        d.text((x, PAD), ch, font=f, fill=255)
        x += cw + tracking
    return m


@lru_cache(maxsize=1024)
def text_layer(text, fpath, size, style="w", tracking=0):
    style = WHITE if style == "w" else style
    return colorize(text_mask(text, fpath, size, tracking), style)


@lru_cache(maxsize=512)
def text_glow(text, fpath, size, style="gold", tracking=0, radius=16):
    m = text_mask(text, fpath, size, tracking).filter(ImageFilter.GaussianBlur(radius))
    m = m.point(lambda v: min(255, int(v * 1.6)))
    return colorize(m, GOLD if style == "gold" else style)


@lru_cache(maxsize=1024)
def char_layers(text, fpath, size, style, tracking=0):
    """글자별 레이어와 (글자 중심 x - 전체 중심 x) 오프셋."""
    f = font(fpath, size)
    widths = [f.getlength(ch) for ch in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    out, x = [], -total / 2
    for ch, cw in zip(text, widths):
        if ch.strip():
            out.append((text_layer(ch, fpath, size, style), x + cw / 2))
        x += cw + tracking
    return out


def shine(layer, pos, width=0.12, strength=0.9):
    """골드 레이어 위로 사선 하이라이트가 지나가게. pos 0..1"""
    if pos <= -0.2 or pos >= 1.2:
        return layer
    arr = np.asarray(layer).astype(np.float32)
    h, w = arr.shape[:2]
    X = np.arange(w)[None, :]
    Y = np.arange(h)[:, None]
    span = w + h * 0.5
    d = (X + Y * 0.5) / span - pos
    band = np.exp(-(d / width) ** 2) * strength
    arr[..., :3] += band[..., None] * (255 - arr[..., :3])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def draw_text(cv, t, text, fpath, size, style, x, y, t0, mode="rise", dur=0.6,
              tracking=0, glow=0.0, t_out=None, anchor="mm", shine_at=None, shine_dur=0.7):
    if t < t0:
        return
    out_a = 1.0 if t_out is None else 1 - seg(t, t_out, 0.25)
    if out_a <= 0:
        return
    p = seg(t, t0, dur)
    lay = text_layer(text, fpath, size, style, tracking)
    if mode == "chars":
        layers = char_layers(text, fpath, size, style, tracking)
        if p >= 1 and shine_at is None and glow == 0:
            mode = "static"
        elif p < 1:
            n = len(layers)
            stag = dur * 0.55 / max(1, n)
            if glow:
                put(cv, text_glow(text, fpath, size, style if style != "w" else WHITE, tracking),
                    x, y, glow * 0.65 * p * out_a, anchor=anchor)
            base_x = x if anchor[0] == "m" else (x + lay.width / 2 - PAD if anchor[0] == "l" else x - lay.width / 2 + PAD)
            for i, (cl, off) in enumerate(layers):
                q = seg(t, t0 + i * stag, dur * 0.45)
                if q <= 0:
                    continue
                dy = (1 - eback(q)) * size * 0.55
                put(cv, cl, base_x + off, y + dy, clamp(q * 1.5) * out_a, scale=lerp(1.25, 1, eo(q)))
            return
        mode = "static"
    if glow:
        put(cv, text_glow(text, fpath, size, style if style != "w" else WHITE, tracking),
            x, y, glow * 0.65 * eo(p) * out_a, anchor=anchor)
    if shine_at is not None and t >= shine_at:
        lay = shine(lay, lerp(-0.15, 1.15, seg(t, shine_at, shine_dur)))
    if mode == "rise":
        put(cv, lay, x, y + (1 - eo(p)) * 46, eo(p) * out_a, anchor=anchor)
    elif mode == "static":
        put(cv, lay, x, y, out_a, anchor=anchor)
    elif mode == "wipe":
        e = eio(p)
        cw = int(lay.width * e)
        if cw > 0:
            part = lay.crop((0, 0, cw, lay.height))
            ox = {"l": 0, "m": lay.width / 2, "r": lay.width}[anchor[0]]
            put(cv, part, x - ox, y, out_a, anchor="l" + anchor[1])
    elif mode == "glitch":
        if p >= 1:
            put(cv, lay, x, y, out_a, anchor=anchor)
            return
        r = np.random.default_rng(int(t * 1000))
        bands = 7
        bh = lay.height / bands
        a = clamp(p * 3) * out_a
        for b in range(bands):
            piece = lay.crop((0, int(b * bh), lay.width, int((b + 1) * bh)))
            dx = (r.random() - 0.5) * 80 * (1 - p) ** 2
            if r.random() < 0.25 * (1 - p):
                piece = colorize(piece.getchannel("A"), GOLD)
            yy = y - lay.height / 2 + b * bh
            put(cv, piece, x + dx, yy, a, anchor=anchor[0] + "t")
    elif mode == "scale":
        put(cv, lay, x, y, eo(p) * out_a, scale=lerp(1.35, 1, eo(p)), anchor=anchor)


# ======================================================================
# 사진 (Higgsfield 생성 이미지)
# ======================================================================
@lru_cache(maxsize=None)
def photo(i, blur=0):
    im = Image.open(os.path.join(ASSETS, f"img{i}.jpg")).convert("RGB")
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return im


def view(img, out_w, out_h, zoom, cx, cy):
    """정규화 좌표(cx,cy) 중심, zoom 배율로 잘라 out 크기로. (box도 반환)"""
    sw, sh = img.size
    cw = sw / zoom
    ch = cw * out_h / out_w
    if ch > sh:
        ch = sh
        cw = ch * out_w / out_h
    x0 = clamp(cx * sw - cw / 2, 0, sw - cw)
    y0 = clamp(cy * sh - ch / 2, 0, sh - ch)
    box = (x0, y0, x0 + cw, y0 + ch)
    return img.transform((out_w, out_h), Image.EXTENT, box, Image.BILINEAR), box


def to_screen(box, nx, ny, sw, sh, out_w, out_h):
    x0, y0, x1, y1 = box
    return ((nx * sw - x0) / (x1 - x0) * out_w, (ny * sh - y0) / (y1 - y0) * out_h)


@lru_cache(maxsize=None)
def edges(i):
    """블루프린트 스캔용 골드 윤곽선 이미지."""
    g = photo(i).convert("L").filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.FIND_EDGES)
    a = np.asarray(g).astype(np.float32)
    a = np.clip((a - 6) * 9, 0, 255)
    rgb = np.stack([a * GOLD_L[c] / 255 for c in range(3)], axis=2)
    return Image.fromarray(rgb.astype(np.uint8), "RGB")


# ======================================================================
# 공용 그래픽 요소
# ======================================================================
@lru_cache(maxsize=None)
def radial(rw, rh, color=GOLD, power=2.0):
    y, x = np.mgrid[0:rh, 0:rw]
    d = np.sqrt(((x - rw / 2) / (rw / 2)) ** 2 + ((y - rh / 2) / (rh / 2)) ** 2)
    a = np.clip(1 - d, 0, 1) ** power * 255
    rgb = np.empty((rh, rw, 3), np.uint8)
    rgb[:] = color
    return Image.fromarray(np.concatenate([rgb, a[..., None].astype(np.uint8)], 2), "RGBA")


@lru_cache(maxsize=None)
def rays(size=1500, n=18):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = a0 + math.pi / n * 0.55
        d.polygon([(c, c), (c + c * 1.5 * math.cos(a0), c + c * 1.5 * math.sin(a0)),
                   (c + c * 1.5 * math.cos(a1), c + c * 1.5 * math.sin(a1))], fill=255)
    fall = np.asarray(radial(size, size, power=1.4).getchannel("A")).astype(np.float32) / 255
    a = np.asarray(m).astype(np.float32) * fall * 0.16
    return colorize(Image.fromarray(a.astype(np.uint8)), GOLD)


def brackets(d, box, length, width, color, prog=1.0):
    x0, y0, x1, y1 = box
    L = length * eo(prog)
    if L < 1:
        return
    for (cx, cy, sx, sy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        d.line([(cx, cy), (cx + sx * L, cy)], fill=color, width=width)
        d.line([(cx, cy), (cx, cy + sy * L)], fill=color, width=width)


def side_ticks(d, x, y0, y1, color, step=40, direction=1):
    k = 0
    for y in range(int(y0), int(y1), step):
        ln = 22 if k % 5 == 0 else 10
        d.line([(x, y), (x + ln * direction, y)], fill=color, width=2)
        k += 1


def rgba(c, a):
    return (c[0], c[1], c[2], int(255 * clamp(a)))


# ---------- 로고: 기어 + 렌치 조형의 T ----------
@lru_cache(maxsize=None)
def gear_mask(S, teeth=12):
    s2 = S * 2
    m = Image.new("L", (s2, s2), 0)
    d = ImageDraw.Draw(m)
    c = s2 / 2
    r_tip, r_root, r_in = 0.48 * s2, 0.415 * s2, 0.345 * s2
    pts = []
    pitch = 2 * math.pi / teeth
    for i in range(teeth):
        a = i * pitch - math.pi / 2
        for frac, r in [(-0.5, r_root), (-0.3, r_root), (-0.17, r_tip), (0.17, r_tip), (0.3, r_root)]:
            pts.append((c + r * math.cos(a + frac * pitch), c + r * math.sin(a + frac * pitch)))
    d.polygon(pts, fill=255)
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], fill=0)
    r2, w2 = 0.31 * s2, 0.012 * s2
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=255, width=int(w2))
    return m.resize((S, S), Image.LANCZOS)


@lru_cache(maxsize=None)
def t_mask(S):
    s2 = S * 2
    m = Image.new("L", (s2, s2), 0)
    d = ImageDraw.Draw(m)
    c = s2 / 2
    u = s2 * 0.86
    # 크로스바 + 스템
    d.rounded_rectangle([c - 0.25 * u, c - 0.205 * u, c + 0.25 * u, c - 0.095 * u], radius=int(0.02 * u), fill=255)
    d.rounded_rectangle([c - 0.06 * u, c - 0.14 * u, c + 0.06 * u, c + 0.24 * u], radius=int(0.02 * u), fill=255)
    # 크로스바 양 끝: 렌치 입(U자 홈)
    for sx in (-1, 1):
        jx = c + sx * 0.25 * u
        d.ellipse([jx - 0.075 * u, c - 0.225 * u, jx + 0.075 * u, c - 0.075 * u], fill=255)
        d.ellipse([jx - 0.034 * u + sx * 0.02 * u, c - 0.184 * u, jx + 0.034 * u + sx * 0.02 * u, c - 0.116 * u], fill=0)
        d.rectangle([jx + sx * 0.02 * u - (0.0 if sx > 0 else 0.1 * u), c - 0.168 * u,
                     jx + sx * 0.02 * u + (0.1 * u if sx > 0 else 0.0), c - 0.132 * u], fill=0)
    # 스템 하단 볼트 홀
    d.ellipse([c - 0.022 * u, c + 0.17 * u, c + 0.022 * u, c + 0.214 * u], fill=0)
    return m.resize((S, S), Image.LANCZOS)


@lru_cache(maxsize=None)
def gear_layer(S):
    return colorize(gear_mask(S), "gold")


@lru_cache(maxsize=None)
def t_layer(S):
    return colorize(t_mask(S), "gold")


def logo(S, angle=0.0, t_dy=0.0, t_alpha=1.0, shine_pos=None):
    lay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    g = gear_layer(S)
    if angle:
        g = g.rotate(angle, Image.BICUBIC)
    lay.alpha_composite(g)
    if t_alpha > 0:
        put(lay, t_layer(S), S / 2, S / 2 + t_dy, t_alpha)
    if shine_pos is not None:
        lay = shine(lay, shine_pos, 0.1)
    return lay


@lru_cache(maxsize=None)
def logo_glow(S):
    m = gear_mask(S).copy()
    m.paste(255, mask=t_mask(S))
    return colorize(m.filter(ImageFilter.GaussianBlur(S * 0.05)), GOLD)


# ---------- 배지/박스 ----------
@lru_cache(maxsize=None)
def rounded_box(w, h, r, fill, border, bw):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([bw // 2, bw // 2, w - 1 - bw // 2, h - 1 - bw // 2], radius=r, fill=fill,
                        outline=border, width=bw)
    return im


@lru_cache(maxsize=None)
def shield(w, h):
    s = 2
    W2, H2 = w * s, h * s

    def poly(inset):
        i = inset * s
        top = i + 0.02 * H2
        return [(W2 / 2, top), (W2 - i, top + 0.09 * H2), (W2 - i, 0.52 * H2),
                (W2 * 0.5, H2 - i * 1.25)] + [(i, 0.52 * H2), (i, top + 0.09 * H2)]

    m_outer = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(m_outer).polygon(poly(0), fill=255)
    m_inner = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(m_inner).polygon(poly(20), fill=255)
    m_line = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(m_line).polygon(poly(36), outline=255, width=4 * s)

    def smooth_poly(m):
        return m.filter(ImageFilter.GaussianBlur(1.2)).resize((w, h), Image.LANCZOS)

    gold = colorize(smooth_poly(m_outer), "gold")
    inner = colorize(smooth_poly(m_inner), (14, 11, 7))
    line = colorize(smooth_poly(m_line), "gold")
    gold.alpha_composite(inner)
    gold.alpha_composite(line)
    return gold


# ---------- 파티클 ----------
_rng = np.random.default_rng(3)
PARTS = [(_rng.random() * W, _rng.random() * H, 20 + _rng.random() * 70, 1.2 + _rng.random() * 3.2,
          _rng.random() * 6.28) for _ in range(70)]


def particles(cv, t, strength=1.0):
    if strength <= 0:
        return
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for (x0, y0, sp, sz, ph) in PARTS:
        y = (y0 - sp * t) % (H + 40) - 20
        x = x0 + 26 * math.sin(t * 0.6 + ph)
        a = (0.25 + 0.6 * (0.5 + 0.5 * math.sin(t * 2.3 + ph * 3))) * strength
        d.ellipse([x - sz * 2.4, y - sz * 2.4, x + sz * 2.4, y + sz * 2.4], fill=rgba(GOLD, a * 0.12))
        d.ellipse([x - sz, y - sz, x + sz, y + sz], fill=rgba(GOLD_L, a))
    cv.alpha_composite(lay)


def burst(cv, u, cx, cy, n=46, seed=5, speed=900, life=1.1):
    if u < 0 or u > life:
        return
    r = np.random.default_rng(seed)
    d = ImageDraw.Draw(cv)
    p = u / life
    for _ in range(n):
        ang = r.random() * 6.283
        v = speed * (0.35 + r.random() * 0.65)
        dist = 270 + v * (1 - (1 - p) ** 2) * 0.9
        x, y = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
        sz = (2 + r.random() * 5) * (1 - p)
        d.ellipse([x - sz, y - sz, x + sz, y + sz], fill=rgba(GOLD_L, 1 - p))


def ring(cv, cx, cy, r, w, color, a):
    if a <= 0 or w < 1:
        return
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(color, a), width=int(w))
    cv.alpha_composite(lay)


def new_canvas():
    return Image.new("RGBA", (W, H), BLACK + (255,))


# ======================================================================
# 장면 1 — 훅 (0–3s)
# ======================================================================
def scene1(u, D):
    cv = new_canvas()
    put(cv, radial(1400, 1400), W / 2, 960, 0.22 * eo(u / 1.5))
    hud = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(hud)
    brackets(d, (70, 170, W - 70, 1750), 90, 4, rgba(GOLD, 0.9), seg(u, 0.0, 0.6))
    side_ticks(d, 70, 300, 1620, rgba(GOLD, 0.25 * seg(u, 0.2, 0.5)), direction=1)
    side_ticks(d, W - 70, 300, 1620, rgba(GOLD, 0.25 * seg(u, 0.2, 0.5)), direction=-1)
    # 스캔 라인
    if u < 1.5:
        sy = lerp(170, 1750, eio(u / 1.4))
        for k in range(60):
            d.line([(70, sy - k * 2), (W - 70, sy - k * 2)], fill=rgba(GOLD, 0.16 * (1 - k / 60)), width=2)
        d.line([(70, sy), (W - 70, sy)], fill=rgba(GOLD_L, 0.95), width=3)
    cv.alpha_composite(hud)
    la = seg(u, 0.2, 0.4)
    put(cv, text_layer("TECHNO AUTO SERVICE", F_MONO, 26, GOLD), 110, 230, la, anchor="lm")
    put(cv, text_layer("SYS.CHECK > ONLINE", F_MONO, 22, GOLD_D), 110, 268, la, anchor="lm")
    put(cv, text_layer("GIMHAE  35.23N 128.88E", F_MONO, 22, GOLD), W - 110, 230, la, anchor="rm")
    put(cv, text_layer(f"T+{u:05.2f}", F_MONO, 22, GOLD_D), W - 110, 268, la, anchor="rm")

    out = 2.72
    draw_text(cv, u, "사고 난 내 차,", F_B, 80, "w", W / 2, 760, 0.35, "glitch", 0.45, t_out=out)
    draw_text(cv, u, "어디서부터", F_EB, 136, "gold", W / 2, 905, 0.8, "chars", 0.7, glow=0.45, t_out=out)
    draw_text(cv, u, "맡겨야 할까?", F_EB, 136, "gold", W / 2, 1060, 1.2, "chars", 0.7, glow=0.45, t_out=out)

    # 진단 프로그레스
    pa = seg(u, 0.5, 0.3) * (1 - seg(u, out, 0.25))
    if pa > 0:
        prog = eio(seg(u, 0.5, 2.2))
        dots = "." * (1 + int(u * 4) % 3)
        put(cv, text_layer("DIAGNOSING" + dots, F_MONO, 26, GOLD), W / 2 - 220, 1420, pa, anchor="lm")
        put(cv, text_layer(f"{int(prog * 100):03d}%", F_MONO, 26, GOLD_L), W / 2 + 220, 1420, pa, anchor="rm")
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        d.rectangle([W / 2 - 220, 1450, W / 2 + 220, 1456], fill=rgba(GOLD_D, 0.5 * pa))
        d.rectangle([W / 2 - 220, 1450, W / 2 - 220 + 440 * prog, 1456], fill=rgba(GOLD_L, pa))
        cv.alpha_composite(lay)
    return cv


# ======================================================================
# 장면 2 — 로고 (3–6s)
# ======================================================================
def scene2(u, D):
    cv = new_canvas()
    put(cv, radial(1300, 1300), W / 2, 800, 0.18 + 0.45 * math.exp(-u / 0.6))
    p = seg(u, 0, 0.8)
    ring(cv, W / 2, 800, 120 + 760 * eo(p), 8 * (1 - p) + 1, GOLD_L, 1 - p)
    ring(cv, W / 2, 800, 80 + 520 * eo(seg(u, 0.1, 0.8)), 3, GOLD, 0.6 * (1 - seg(u, 0.1, 0.8)))

    S = 470
    sc = lerp(0.45, 1.0, eback(seg(u, 0, 0.75)))
    ang = -140 * (1 - eo(seg(u, 0, 0.95))) - u * 6
    t_dy = -260 * (1 - eback(seg(u, 0.35, 0.5)))
    shine_pos = lerp(-0.2, 1.2, seg(u, 1.45, 0.7)) if u > 1.45 else None
    put(cv, logo_glow(S), W / 2, 800, 0.55 * seg(u, 0.5, 0.5), scale=sc)
    put(cv, logo(S, ang, t_dy, seg(u, 0.35, 0.2), shine_pos), W / 2, 800, seg(u, 0, 0.25), scale=sc)

    draw_text(cv, u, "TECHNO", F_EB, 132, "gold", W / 2 + 14, 1170, 0.75, "chars", 0.6, tracking=30,
              glow=0.4, shine_at=1.75)
    lp = eo(seg(u, 1.0, 0.45))
    if lp > 0:
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        d.line([(W / 2 - 320 * lp, 1262), (W / 2 - 22, 1262)], fill=rgba(GOLD, 0.9), width=3)
        d.line([(W / 2 + 22, 1262), (W / 2 + 320 * lp, 1262)], fill=rgba(GOLD, 0.9), width=3)
        d.polygon([(W / 2, 1252), (W / 2 + 10, 1262), (W / 2, 1272), (W / 2 - 10, 1262)], fill=rgba(GOLD_L, lp))
        cv.alpha_composite(lay)
    draw_text(cv, u, "테크노자동차정비", F_B, 68, "w", W / 2, 1340, 1.15, "rise", 0.55)
    draw_text(cv, u, "GIMHAE  ·  AUTO BODY & PAINT", F_R, 30, GOLD_L, W / 2, 1420, 1.35, "rise", 0.55, tracking=6)
    return cv


# ======================================================================
# 장면 3 — 기술력: 차량 스캔 + 콜아웃 (6–11s)
# ======================================================================
CALLOUTS = [
    # (앵커 정규화 x,y), (라벨 화면 x,y), 영문, 한글, 시작
    ((0.42, 0.408), (255, 640), "ALL BRANDS", "전 차종", 1.35),
    ((0.63, 0.468), (825, 640), "PAINTING", "도장", 1.7),
    ((0.36, 0.505), (255, 1440), "SHEET METAL", "판금", 2.05),
    ((0.80, 0.600), (825, 1440), "ACCIDENT REPAIR", "사고수리", 2.4),
]


def scene3(u, D):
    img = photo(1)
    z = lerp(1.1, 1.0, eio(u / D))
    frame, box = view(img, W, H, z, 0.5, 0.5)
    cv = frame.convert("RGBA")
    # 블루프린트 스캔
    bp = seg(u, 0.15, 1.3)
    if 0 < bp < 1 or u < 2.4:
        e, _ = view(edges(1), W, H, z, 0.5, 0.5)
        beam = lerp(200, 1750, eio(bp))
        ys = np.arange(H)
        dist = beam - ys
        a = np.where(dist >= 0, np.exp(-dist / 260.0), 0) * (1 - seg(u, 1.6, 0.8))
        ea = np.asarray(e).astype(np.float32) * a[:, None, None]
        base = np.asarray(cv.convert("RGB")).astype(np.float32)
        cv = Image.fromarray(np.clip(base + ea, 0, 255).astype(np.uint8)).convert("RGBA")
        if bp < 1:
            hud = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(hud)
            for k in range(40):
                d.line([(40, beam - k * 2), (W - 40, beam - k * 2)], fill=rgba(GOLD, 0.12 * (1 - k / 40)), width=2)
            d.line([(40, beam), (W - 40, beam)], fill=rgba(GOLD_L, 0.9), width=3)
            cv.alpha_composite(hud)

    hud = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(hud)
    fa = seg(u, 0, 0.5)
    d.rectangle([40, 40, W - 40, H - 40], outline=rgba(GOLD, 0.28 * fa), width=2)
    brackets(d, (40, 40, W - 40, H - 40), 80, 5, rgba(GOLD_L, 0.9), seg(u, 0, 0.5))
    side_ticks(d, 40, 560, 1360, rgba(GOLD, 0.45 * fa), direction=1)
    side_ticks(d, W - 40, 560, 1360, rgba(GOLD, 0.45 * fa), direction=-1)
    cv.alpha_composite(hud)
    put(cv, text_layer("01 / TECHNOLOGY", F_MONO, 22, GOLD), 80, 90, fa, anchor="lm")
    put(cv, text_layer("SCAN : BODY / FRAME / PAINT", F_MONO, 20, GOLD), 80, H - 90, fa, anchor="lm")
    put(cv, text_layer("TECHNO DIAG 2.6", F_MONO, 20, GOLD), W - 80, H - 90, fa, anchor="rm")

    draw_text(cv, u, "전 차종 사고수리부터", F_B, 70, "w", W / 2, 300, 0.25, "rise", 0.55)
    draw_text(cv, u, "판금 · 도장까지", F_EB, 124, "gold", W / 2, 435, 0.5, "chars", 0.65, glow=0.45,
              shine_at=3.4, shine_dur=0.8)

    sw, sh = img.size
    for (nx, ny), (lx, ly), en, ko, t0 in CALLOUTS:
        if u < t0:
            continue
        ax, ay = to_screen(box, nx, ny, sw, sh, W, H)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        q = seg(u, t0, 0.2)
        pulse = (u - t0) % 1.2 / 1.2
        rr = 10 + 26 * pulse
        d.ellipse([ax - rr, ay - rr, ax + rr, ay + rr], outline=rgba(GOLD_L, 0.8 * (1 - pulse)), width=2)
        d.ellipse([ax - 9 * q, ay - 9 * q, ax + 9 * q, ay + 9 * q], fill=rgba(GOLD_L, 1))
        d.ellipse([ax - 16 * q, ay - 16 * q, ax + 16 * q, ay + 16 * q], outline=rgba(GOLD, 0.9), width=2)
        # 꺾인 지시선: 앵커 → (lx, ay 쪽 꺾임) → 라벨
        top = ly < ay
        ex, ey = lx, ly + (52 if top else -52)
        mx, my = ax, ey
        lp = eio(seg(u, t0 + 0.1, 0.35))
        L1 = abs(my - ay)
        L2 = abs(ex - mx)
        tot = L1 + L2
        dl = lp * tot
        if dl > 0:
            p1 = min(dl, L1)
            y1 = ay + (p1 if my > ay else -p1)
            d.line([(ax, ay), (ax, y1)], fill=rgba(GOLD_L, 0.95), width=3)
            if dl > L1:
                p2 = dl - L1
                x2 = mx + (p2 if ex > mx else -p2)
                d.line([(mx, my), (x2, my)], fill=rgba(GOLD_L, 0.95), width=3)
        cv.alpha_composite(lay)
        ba = eo(seg(u, t0 + 0.4, 0.3))
        if ba > 0:
            bw, bh = 330, 104
            put(cv, rounded_box(bw, bh, 10, (10, 9, 7, 215), GOLD + (255,), 3), lx, ly, ba,
                scale=lerp(0.85, 1, ba))
            put(cv, text_layer(en, F_MONO, 20, GOLD_L, 2), lx, ly - 24, ba)
            put(cv, text_layer(ko, F_EB, 46, "w"), lx, ly + 16, ba)
    return cv


# ======================================================================
# 장면 4 — 3분할 공정 (11–15s)
# ======================================================================
BANDS = [
    # (이미지, cy0, cy1, zoom0, zoom1, 번호, 한글, 영문, 라벨 쪽)
    (2, 0.40, 0.45, 1.05, 1.0, "01", "판금", "SHEET METAL", "l"),
    (3, 0.38, 0.42, 1.0, 1.08, "02", "도장", "PAINTING", "r"),
    (4, 0.27, 0.31, 1.06, 1.0, "03", "사고수리", "ACCIDENT REPAIR", "l"),
]
BH = H // 3


@lru_cache(maxsize=None)
def band_shade(side):
    y, x = np.mgrid[0:BH, 0:W]
    xs = x / W if side == "l" else 1 - x / W
    a = np.clip((1 - xs * 1.6), 0, 1) * 0.55 + np.clip((y / BH - 0.45) * 1.4, 0, 1) * 0.45
    a = np.clip(a, 0, 0.85) * 255
    rgb = np.zeros((BH, W, 3), np.uint8)
    return Image.fromarray(np.concatenate([rgb, a[..., None].astype(np.uint8)], 2), "RGBA")


def scene4(u, D):
    cv = new_canvas()
    for i, (im, cy0, cy1, z0, z1, num, ko, en, side) in enumerate(BANDS):
        t0 = i * 0.13
        p = eo(seg(u, t0, 0.5))
        if p <= 0:
            continue
        fr, _ = view(photo(im), W, BH, lerp(z0, z1, u / D), 0.5, lerp(cy0, cy1, u / D))
        fr = fr.convert("RGBA")
        fr.alpha_composite(band_shade(side))
        dirn = -1 if i % 2 == 0 else 1
        comp(cv, fr, dirn * W * (1 - p), i * BH)
        la = seg(u, 0.55 + i * 0.15, 0.4)
        y_base = i * BH + BH - 120
        if side == "l":
            x = 70 + (1 - eo(la)) * -40
            put(cv, text_layer(num, F_SERIF, 64, "gold"), x, y_base - 70, la, anchor="lm")
            put(cv, text_layer(ko, F_EB, 84, "w"), x, y_base + 10, la, anchor="lm")
            put(cv, text_layer(en, F_MONO, 22, GOLD_L, 3), x + 4, y_base + 72, la, anchor="lm")
        else:
            x = W - 70 + (1 - eo(la)) * 40
            put(cv, text_layer(num, F_SERIF, 64, "gold"), x, y_base - 70, la, anchor="rm")
            put(cv, text_layer(ko, F_EB, 84, "w"), x, y_base + 10, la, anchor="rm")
            put(cv, text_layer(en, F_MONO, 22, GOLD_L, 3), x - 4, y_base + 72, la, anchor="rm")
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for k, yy in enumerate((BH, 2 * BH)):
        lp = eio(seg(u, 0.45 + k * 0.1, 0.4))
        if lp > 0:
            d.rectangle([W / 2 - W / 2 * lp, yy - 3, W / 2 + W / 2 * lp, yy + 3], fill=rgba(GOLD, 1))
            d.rectangle([W / 2 - W / 2 * lp, yy - 1, W / 2 + W / 2 * lp, yy + 1], fill=rgba(GOLD_L, 1))
    cv.alpha_composite(lay)
    # 가운데 캡션
    ca = eo(seg(u, 1.25, 0.4))
    if ca > 0:
        put(cv, rounded_box(900, 128, 64, (8, 7, 5, 200), GOLD + (255,), 3), W / 2, H / 2 - 40, ca,
            scale=lerp(0.9, 1, ca))
        draw_text(cv, u, "수리의 시작과 끝을 책임집니다", F_EB, 56, "w", W / 2, H / 2 - 40, 1.35, "rise", 0.45)
        draw_text(cv, u, "FROM START TO FINISH", F_MONO, 22, GOLD_L, W / 2, H / 2 - 135, 1.45, "rise", 0.45,
                  tracking=6)
    return cv


# ======================================================================
# 장면 5 — 10년 무상 품질보증 (15–19s)
# ======================================================================
STAMP_T = 0.7


def scene5(u, D):
    cv = new_canvas()
    r = rays()
    put(cv, r.rotate(u * 7, Image.BICUBIC), W / 2, 800, seg(u, 0, 0.6))
    put(cv, radial(1300, 1300), W / 2, 800, 0.3 + 0.4 * math.exp(-max(0, u - STAMP_T) / 0.5) * (u > STAMP_T))

    sk = u - STAMP_T
    shake = 16 * math.exp(-sk * 9) if sk > 0 else 0
    ox, oy = shake * math.sin(u * 95), shake * math.cos(u * 77)
    sc = lerp(0.35, 1, eback(seg(u, 0, 0.45)))
    if sk > 0:
        sc *= 1 + 0.09 * math.exp(-sk * 10) * math.cos(sk * 28)
    cx, cy = W / 2 + ox, 800 + oy
    put(cv, shield(560, 640), cx, cy, seg(u, 0, 0.2), scale=sc)
    n = int(round(10 * eo(seg(u, 0.05, STAMP_T - 0.05))))
    num = str(n)
    sh = lerp(-0.2, 1.2, seg(u, 1.7, 0.8)) if u > 1.7 else None
    numl = text_layer(num, F_SERIF, 290, "gold")
    if sh is not None:
        numl = shine(numl, sh)
    put(cv, text_glow(num, F_SERIF, 290, "gold", 0, 22), cx, cy - 40, 0.5 * seg(u, 0, 0.3), scale=sc)
    put(cv, numl, cx, cy - 40, seg(u, 0, 0.25), scale=sc)
    put(cv, text_layer("YEARS", F_EB, 44, GOLD_L, 14), cx, cy + 150 * sc, seg(u, 0.3, 0.3), scale=sc)

    if sk > 0:
        p = seg(sk, 0, 0.7)
        ring(cv, cx, cy, 300 + 500 * eo(p), 10 * (1 - p) + 1, GOLD_L, 1 - p)
        burst(cv, sk, cx, cy)

    la = seg(u, 0.2, 0.4)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.line([(W / 2 - 330, 400), (W / 2 - 200, 400)], fill=rgba(GOLD, la), width=2)
    d.line([(W / 2 + 200, 400), (W / 2 + 330, 400)], fill=rgba(GOLD, la), width=2)
    cv.alpha_composite(lay)
    put(cv, text_layer("TECHNO PROMISE", F_MONO, 26, GOLD_L, 6), W / 2, 400, la)

    draw_text(cv, u, "10년 무상 품질보증", F_EB, 108, "gold", W / 2, 1265, 0.9, "chars", 0.65, glow=0.5,
              shine_at=2.3, shine_dur=0.8)
    draw_text(cv, u, "수리 후에도 끝까지 책임집니다", F_B, 52, "w", W / 2, 1385, 1.35, "rise", 0.55)
    return cv


# ======================================================================
# 장면 6 — 편의 서비스 체크리스트 (19–25s)
# ======================================================================
PH_H = 860
PHOTOS6 = [(7, 0.0, 0.53, 1.12, 1.0), (5, 1.75, 0.47, 1.0, 1.08), (6, 3.35, 0.40, 1.08, 1.0)]
ROWS = [("무료 픽업·딜리버리", "FREE PICK-UP & DELIVERY", 0.6),
        ("무상대차", "FREE LOANER CAR", 2.2),
        ("수리 전 과정 고객 소통", "REAL-TIME REPAIR UPDATES", 3.8)]
ROW_Y = [1185, 1300, 1415]
STEPS = ["접수", "진단", "수리", "출고"]


@lru_cache(maxsize=None)
def photo_fade():
    a = np.zeros((PH_H, W), np.float32)
    ys = np.arange(PH_H)
    a[:] = np.clip((ys - 520) / (PH_H - 520), 0, 1)[:, None] ** 1.3 * 255
    rgb = np.zeros((PH_H, W, 3), np.uint8)
    rgb[:] = BLACK
    return Image.fromarray(np.concatenate([rgb, a[..., None].astype(np.uint8)], 2), "RGBA")


def notif(cv, y, title, msg, a, dx):
    if a <= 0:
        return
    put(cv, rounded_box(920, 140, 28, (16, 14, 10, 235), GOLD_D + (255,), 2), W / 2 + dx, y, a)
    put(cv, rounded_box(84, 84, 20, (6, 5, 4, 255), GOLD + (255,), 3), 120 + 42 + dx, y, a)
    put(cv, logo(76), 162 + dx, y, a)
    put(cv, text_layer(title, F_B, 30, GOLD_L), 230 + dx, y - 26, a, anchor="lm")
    put(cv, text_layer(msg, F_B, 34, "w"), 230 + dx, y + 22, a, anchor="lm")
    put(cv, text_layer("지금", F_R, 26, (150, 140, 120)), W - 120 + dx, y - 26, a, anchor="rm")


def scene6(u, D):
    cv = new_canvas()
    # 상단 사진 창
    ph = Image.new("RGBA", (W, PH_H), BLACK + (255,))
    for k, (im, t0, ccy, z0, z1) in enumerate(PHOTOS6):
        t1 = PHOTOS6[k + 1][1] if k + 1 < len(PHOTOS6) else D
        if u < t0 - 0.01 or u > t1 + 0.3:
            continue
        a = 1.0 if k == 0 else eio(seg(u, t0, 0.3))
        loc = (u - t0) / (t1 - t0 + 0.3)
        fr, _ = view(photo(im), W, PH_H, lerp(z0, z1, clamp(loc)), 0.5, ccy)
        ph.alpha_composite(alpha_mul(fr.convert("RGBA"), a))
    ph.alpha_composite(photo_fade())
    cv.alpha_composite(ph)

    hud = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(hud)
    brackets(d, (40, 40, W - 40, PH_H - 120), 70, 4, rgba(GOLD_L, 0.9), seg(u, 0, 0.5))
    # 1) 픽업 경로
    if u < 2.0:
        ra = 1 - seg(u, 1.65, 0.3)
        pts = []
        for k in range(61):
            s = k / 60
            x = lerp(140, 940, s)
            y = 640 - 380 * s + 120 * math.sin(s * math.pi * 1.6)
            pts.append((x, y))
        rp = eio(seg(u, 0.15, 1.3))
        upto = int(rp * 60)
        for k in range(0, upto, 2):
            d.line([pts[k], pts[k + 1]], fill=rgba(GOLD_L, 0.95 * ra), width=5)
        for (px, py), lab, tt in [(pts[0], "PICK-UP", 0.15), (pts[-1], "DELIVERY", 1.4)]:
            if u >= tt:
                q = eback(seg(u, tt, 0.3))
                d.ellipse([px - 14 * q, py - 14 * q, px + 14 * q, py + 14 * q], fill=rgba(GOLD, ra))
                d.ellipse([px - 26 * q, py - 26 * q, px + 26 * q, py + 26 * q], outline=rgba(GOLD_L, 0.8 * ra), width=3)
        if 0 < rp < 1:
            hx, hy = pts[upto]
            d.ellipse([hx - 12, hy - 12, hx + 12, hy + 12], fill=rgba(WHITE, ra))
    cv.alpha_composite(hud)
    if u < 2.0:
        ra = 1 - seg(u, 1.65, 0.3)
        put(cv, text_layer("PICK-UP", F_MONO, 24, GOLD_L, 3), 140, 700, seg(u, 0.25, 0.3) * ra)
        put(cv, text_layer("DELIVERY", F_MONO, 24, GOLD_L, 3), 940, 200, seg(u, 1.5, 0.3) * ra)
    # 3) 소통 알림
    for k, (tt, msg) in enumerate([(3.75, "수리 진행 사진이 도착했습니다"), (4.55, "출고 준비가 완료되었습니다")]):
        q = eo(seg(u, tt, 0.4))
        notif(cv, 150 + k * 165, "테크노자동차정비", msg, q, (1 - q) * 120)

    draw_text(cv, u, "기술력은 물론,", F_B, 62, "w", W / 2, 920, 0.1, "rise", 0.5)
    draw_text(cv, u, "고객의 편리함까지", F_EB, 104, "gold", W / 2, 1030, 0.3, "chars", 0.65, glow=0.45)

    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for (ko, en, tt), y in zip(ROWS, ROW_Y):
        ap = seg(u, tt - 0.4, 0.35)
        if ap <= 0:
            continue
        x0 = 120 - (1 - eo(ap)) * 60
        dim = 0.78 if u > tt + 1.6 else 1.0
        d.rounded_rectangle([x0, y - 32, x0 + 64, y + 32], radius=10, outline=rgba(GOLD, ap), width=4)
        fp = eo(seg(u, tt, 0.18))
        if fp > 0:
            s = 32 * fp
            d.rounded_rectangle([x0 + 32 - s, y - s, x0 + 32 + s, y + s], radius=10, fill=rgba(GOLD, 1))
            cp = seg(u, tt + 0.08, 0.25)
            ck = [(x0 + 14, y + 2), (x0 + 27, y + 15), (x0 + 51, y - 13)]
            if cp > 0:
                if cp < 0.4:
                    e = cp / 0.4
                    d.line([ck[0], (lerp(ck[0][0], ck[1][0], e), lerp(ck[0][1], ck[1][1], e))], fill=BLACK, width=8)
                else:
                    e = (cp - 0.4) / 0.6
                    d.line([ck[0], ck[1], (lerp(ck[1][0], ck[2][0], e), lerp(ck[1][1], ck[2][1], e))],
                           fill=BLACK, width=8, joint="curve")
        # 활성 줄 하이라이트
        hp = seg(u, tt, 0.5) * (1 - seg(u, tt + 1.4, 0.3))
        if hp > 0:
            d.rectangle([x0 + 92, y + 52, x0 + 92 + 780 * eo(seg(u, tt, 0.5)), y + 54], fill=rgba(GOLD, hp))
    cv.alpha_composite(lay)
    for (ko, en, tt), y in zip(ROWS, ROW_Y):
        ap = seg(u, tt - 0.4, 0.35)
        if ap <= 0:
            continue
        x0 = 120 - (1 - eo(ap)) * 60
        dim = 0.7 if u > tt + 1.6 else 1.0
        put(cv, text_layer(ko, F_EB, 54, "w"), x0 + 96, y - 10, ap * dim, anchor="lm")
        put(cv, text_layer(en, F_MONO, 20, GOLD_L, 3), x0 + 98, y + 34, ap * dim, anchor="lm")

    # 진행 트래커
    ta = seg(u, 4.0, 0.35)
    if ta > 0:
        xs = [200, 427, 653, 880]
        ty = 1545
        fill = eio(seg(u, 4.25, 1.4))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        d.line([(xs[0], ty), (xs[-1], ty)], fill=rgba(GOLD_D, 0.6 * ta), width=4)
        d.line([(xs[0], ty), (lerp(xs[0], xs[-1], fill), ty)], fill=rgba(GOLD_L, ta), width=6)
        for k, x in enumerate(xs):
            on = fill >= k / 3 - 1e-6
            rr = 16
            if on:
                d.ellipse([x - 30, ty - 30, x + 30, ty + 30], fill=rgba(GOLD, 0.18 * ta))
            d.ellipse([x - rr, ty - rr, x + rr, ty + rr], fill=rgba(GOLD if on else (40, 34, 24), ta),
                      outline=rgba(GOLD_L, ta), width=3)
        cv.alpha_composite(lay)
        for k, (x, s) in enumerate(zip(xs, STEPS)):
            on = fill >= k / 3 - 1e-6
            put(cv, text_layer(s, F_B, 32, GOLD_L if on else (130, 120, 100)), x, ty + 52, ta)
    return cv


# ======================================================================
# 장면 7 — 클로징 메시지 (25–27.5s)
# ======================================================================
def scene7(u, D):
    fr, _ = view(photo(1, blur=5), W, H, lerp(2.3, 2.45, u / D), 0.66, 0.5)
    arr = np.asarray(fr).astype(np.float32) * 0.6
    cv = Image.fromarray(arr.astype(np.uint8)).convert("RGBA")
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    bh = 250 * eo(seg(u, 0, 0.5))
    d.rectangle([0, 0, W, bh], fill=BLACK + (255,))
    d.rectangle([0, H - bh, W, H], fill=BLACK + (255,))
    if bh > 1:
        d.line([(0, bh), (W, bh)], fill=rgba(GOLD, 0.6), width=2)
        d.line([(0, H - bh), (W, H - bh)], fill=rgba(GOLD, 0.6), width=2)
    cv.alpha_composite(lay)
    draw_text(cv, u, "맡기는 순간부터", F_B, 78, "w", W / 2, 770, 0.05, "rise", 0.5)
    draw_text(cv, u, "찾는 날까지,", F_B, 78, "w", W / 2, 880, 0.4, "rise", 0.5)
    draw_text(cv, u, "테크노가 끝까지.", F_SERIF, 132, "gold", W / 2, 1065, 0.8, "chars", 0.7, glow=0.55,
              shine_at=1.6, shine_dur=0.7)
    return cv


# ======================================================================
# 장면 8 — 엔드카드 (27.5–30s)
# ======================================================================
def scene8(u, D):
    cv = new_canvas()
    put(cv, rays().rotate(u * 5, Image.BICUBIC), W / 2, 560, 0.7 * seg(u, 0, 0.6))
    put(cv, radial(1200, 1200), W / 2, 600, 0.25)
    S = 300
    la = eo(seg(u, 0, 0.45))
    put(cv, logo_glow(S), W / 2, 500, 0.5 * la, scale=lerp(0.6, 1, la))
    put(cv, logo(S, -u * 8, 0, 1, lerp(-0.2, 1.2, seg(u, 0.6, 0.7)) if u > 0.6 else None),
        W / 2, 500, la, scale=lerp(0.6, 1, eback(seg(u, 0, 0.45))))
    draw_text(cv, u, "TECHNO", F_EB, 100, "gold", W / 2 + 12, 745, 0.12, "chars", 0.5, tracking=24, glow=0.35)
    draw_text(cv, u, "테크노자동차정비", F_B, 60, "w", W / 2, 840, 0.25, "rise", 0.45)
    lp = eo(seg(u, 0.3, 0.4))
    if lp > 0:
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(lay).line([(W / 2 - 280 * lp, 905), (W / 2 + 280 * lp, 905)], fill=rgba(GOLD, 0.9), width=2)
        cv.alpha_composite(lay)
    draw_text(cv, u, "김해 · 전 차종 사고수리 · 판금 · 도장", F_R, 36, GOLD_L, W / 2, 960, 0.35, "rise", 0.45)

    pa = eo(seg(u, 0.45, 0.4))
    if pa > 0:
        put(cv, rounded_box(900, 210, 30, (22, 18, 10, 230), GOLD + (255,), 4), W / 2, 1150, pa,
            scale=lerp(0.9, 1, pa))
        put(cv, text_layer("상담 · 예약 문의", F_B, 32, GOLD_L), W / 2, 1090, pa)
        ph = text_layer(PHONE, F_EB, 104, "gold", 2)
        if u > 1.0:
            ph = shine(ph, lerp(-0.2, 1.2, seg(u, 1.0, 0.8)))
        put(cv, text_glow(PHONE, F_EB, 104, "gold", 2, 18), W / 2, 1172, 0.4 * pa)
        put(cv, ph, W / 2, 1172, pa, scale=lerp(1.1, 1, pa))
    draw_text(cv, u, "지금 바로 상담하세요", F_EB, 58, "w", W / 2, 1335, 0.7, "rise", 0.45)
    pulse = 0.5 + 0.5 * math.sin(u * 6)
    if u > 1.0:
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(lay).rectangle([W / 2 - 250, 1378, W / 2 + 250, 1382], fill=rgba(GOLD, 0.4 + 0.5 * pulse))
        cv.alpha_composite(lay)
    tags = ["무료 픽업·딜리버리", "무상대차", "10년 품질보증"]
    widths = [font(F_B, 28).getlength(s) + 48 for s in tags]
    total = sum(widths) + 20 * (len(tags) - 1)
    x = W / 2 - total / 2
    for k, (s, w) in enumerate(zip(tags, widths)):
        ta = eo(seg(u, 0.85 + k * 0.1, 0.35))
        put(cv, rounded_box(int(w), 60, 30, (14, 12, 8, 220), GOLD_D + (255,), 2), x + w / 2, 1465, ta)
        put(cv, text_layer(s, F_B, 28, GOLD_L), x + w / 2, 1465, ta)
        x += w + 20
    return cv


SCENE_FNS = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8]
PARTICLE_STRENGTH = [0.5, 0.9, 0.35, 0.0, 0.9, 0.25, 0.5, 0.8]


# ======================================================================
# 후처리
# ======================================================================
@lru_cache(maxsize=None)
def vignette():
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W * 0.62)) ** 2 + ((y - H / 2) / (H * 0.62)) ** 2)
    return (1 - 0.55 * np.clip(d - 0.35, 0, 1) ** 1.6)[..., None].astype(np.float32)


@lru_cache(maxsize=None)
def grain(k):
    r = np.random.default_rng(100 + k)
    return (r.standard_normal((H, W, 1)) * 3).astype(np.float32)


def render(fi):
    t = fi / FPS
    idx = max(i for i, (s, _) in enumerate(SCENES) if t >= s - 1e-9)
    s0, s1 = SCENES[idx]
    u = t - s0
    cv = SCENE_FNS[idx](u, s1 - s0)
    particles(cv, t, PARTICLE_STRENGTH[idx])
    # 컷 직후 줌 펀치
    if idx > 0 and u < 0.35:
        z = 1 + 0.05 * (1 - eo(u / 0.35))
        nw, nh = int(W * z), int(H * z)
        big = cv.resize((nw, nh), Image.BILINEAR)
        cv = big.crop(((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H))
    arr = np.asarray(cv.convert("RGB")).astype(np.float32)
    # 컷 플래시 (골드 라이트)
    for c in CUTS:
        dt = t - c
        if 0 <= dt < 0.3:
            a = 0.55 * (1 - dt / 0.3) ** 2
            arr = arr * (1 - a) + np.array(GOLD_L, np.float32) * a
    arr = arr * vignette() + grain(fi % 6)
    # 마지막 프레임 페이드는 하지 않음 (엔드카드 유지)
    return np.clip(arr, 0, 255).astype(np.uint8)


def render_bytes(fi):
    return render(fi).tobytes()


def stills(times, outdir):
    os.makedirs(outdir, exist_ok=True)
    for tt in times:
        fi = min(NF - 1, int(round(tt * FPS)))
        Image.fromarray(render(fi)).save(os.path.join(outdir, f"still_{tt:05.2f}.jpg"), quality=88)
    print("stills ->", outdir)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--stills":
        times = [float(x) for x in sys.argv[2].split(",")]
        stills(times, sys.argv[3] if len(sys.argv) > 3 else "stills")
        return
    out = sys.argv[1] if len(sys.argv) > 1 else "techno_promo.mp4"
    wav = os.path.splitext(out)[0] + "_bgm.wav"
    subprocess.run([sys.executable, os.path.join(HERE, "techno_bgm.py"), wav], check=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-af", "volume=-4dB",
           "-shortest", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(render_bytes, range(NF), chunksize=3)):
            proc.stdin.write(buf)
            if k % 60 == 0:
                print(f"frame {k}/{NF}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("wrote", out)


if __name__ == "__main__":
    main()
