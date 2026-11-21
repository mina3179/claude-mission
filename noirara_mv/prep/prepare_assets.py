"""Prepare derived assets for the Remotion project.
- Copies originals unchanged into public/.
- Cuts the Instagram profile screenshots into their individual artwork tiles
  (pure pixel crops along the white grid gutters, no resampling / retouching).
- Writes the gridded portfolio page (tile area only) for the 'wall' shots.
"""
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"; P = ROOT / "public"
(P / "tiles").mkdir(parents=True, exist_ok=True)
for sub in ["webtoon", "provided_photos", "audio"]:
    (P / sub).mkdir(parents=True, exist_ok=True)
    for f in (A / sub).iterdir():
        shutil.copy2(f, P / sub / f.name)

def runs(idx):
    out = []
    for v in idx:
        if out and v == out[-1][1] + 1: out[-1][1] = v
        else: out.append([v, v])
    return out

meta = {}
for name in ["1000127645", "1000127647", "1000127649"]:
    img = Image.open(A / "provided_photos" / f"{name}.jpg").convert("RGB")
    W, H = img.size
    g = np.asarray(img.convert("L")).astype(float)
    # 3 fixed columns (white vertical gutters at x=234-236 and 472-474).
    xs, xe = [0, 237, 475], [234, 472, 709]
    # Horizontal gutters: thin rows that are almost entirely white, below the
    # profile tab bar (ends at y=236) and above the navigation bar (y>=1454).
    fr = (g > 228).mean(1)
    gut = [r for r in runs([y for y in range(240, 1450) if fr[y] > 0.9]) if r[1] - r[0] <= 5]
    rows = []
    top = 237
    for a, b in gut:
        rows.append((max(top, a - 311), a))   # first row may be tucked under the tab bar
        top = b + 1
    tiles = []
    for ri, (y0, y1) in enumerate(rows):
        for ci, (x0, x1) in enumerate(zip(xs, xe)):
            t = img.crop((x0, y0, x1, y1))
            fn = f"tiles/{name}_r{ri}c{ci}.png"
            t.save(P / fn)
            tiles.append({"file": fn, "w": t.width, "h": t.height})
    gy0, gy1 = rows[0][0], rows[-1][1]
    page = img.crop((0, gy0, W, gy1)); page.save(P / f"tiles/{name}_grid.png")
    meta[name] = {"tiles": tiles, "grid": {"file": f"tiles/{name}_grid.png", "w": page.width, "h": page.height}}
    print(name, "rows", rows, "cols", list(zip(xs, xe)))

# logo: square crop centred on the circular emblem (the emblem itself is untouched;
# the screenshot's mute icon in the corner is hidden by a circular mask at render time)
logo = Image.open(A / "provided_photos" / "1000127644.jpg").convert("RGB")
logo.save(P / "logo_square.png")
json.dump(meta, open(P / "tiles" / "tiles.json", "w"), indent=1)

# --- render helpers (derived copies only; originals above stay untouched) ---
from PIL import ImageFilter
(P / "blur").mkdir(exist_ok=True); (P / "tiles_x3").mkdir(exist_ok=True); (P / "fx").mkdir(exist_ok=True)

def blurred(src, dst, radius=18):
    im = Image.open(src).convert("RGB")
    s = 360 / max(im.size)
    small = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    small.filter(ImageFilter.GaussianBlur(radius)).save(dst, quality=92)

for f in list((P / "provided_photos").glob("*.jpg")) + list((P / "provided_photos").glob("*.webp")):
    blurred(f, P / "blur" / f"{f.stem}.jpg")
for f in (P / "webtoon").glob("*.png"):
    blurred(f, P / "blur" / f"{f.stem}.jpg")
for f in (P / "tiles").glob("*_r*c*.png"):
    blurred(f, P / "blur" / f"{f.stem}.jpg", 14)
    im = Image.open(f).convert("RGB")
    # high-quality Lanczos resample so the browser never has to upscale the small
    # Instagram thumbnails with its softer bilinear filter (content is unchanged)
    im.resize((im.width * 3, im.height * 3), Image.LANCZOS).save(P / "tiles_x3" / f.name)
for f in (P / "tiles").glob("*_grid.png"):
    im = Image.open(f).convert("RGB")
    im.resize((im.width * 2, im.height * 2), Image.LANCZOS).save(P / "tiles_x3" / f.name)

# film grain frames
rng = np.random.default_rng(7)
for i in range(8):
    n = rng.normal(128, 38, (480, 270)).clip(0, 255).astype(np.uint8)
    Image.fromarray(n, "L").resize((1080, 1920), Image.NEAREST).save(P / "fx" / f"grain{i}.png", optimize=True)
print("done")

# --- second batch: higher-resolution profile grid captures + on-set screenshots ---
A2 = ROOT / "assets" / "provided_photos_2"
if A2.exists():
    (P / "tiles2").mkdir(exist_ok=True)
    (P / "onset").mkdir(exist_ok=True)
    meta2 = {}
    for name in ["grid_a", "grid_b", "grid_c"]:
        img = Image.open(A2 / f"{name}.jpg").convert("RGB")
        g = np.asarray(img.convert("L")).astype(float)
        H2, W2 = g.shape
        fr = (g > 235).mean(1); fc = (g > 235).mean(0)
        wr = runs([y for y in range(H2) if fr[y] > 0.97])
        wc = [r for r in runs([x for x in range(W2) if fc[x] > 0.97]) if r[1] - r[0] < 12]
        xs = [0] + [b + 1 for a, b in wc]; xe = [a for a, b in wc] + [W2]
        top = wr[0][1] + 1 if wr and wr[0][0] == 0 else 0
        gut = [r for r in wr if r[0] > 50]
        ys = [top] + [b + 1 for a, b in gut]; ye = [a for a, b in gut] + [H2]
        for ri, (y0, y1) in enumerate(zip(ys, ye)):
            for ci, (x0, x1) in enumerate(zip(xs, xe)):
                t = img.crop((x0, y0, x1, y1))
                tid = f"{name}_r{ri}c{ci}"
                t.save(P / "tiles2" / f"{tid}.png")
                blurred(P / "tiles2" / f"{tid}.png", P / "blur" / f"{tid}.jpg", 14)
                meta2[tid] = [t.width, t.height]
        full = [(a, b) for a, b in zip(ys, ye) if b - a > 0.97 * max(e - s for s, e in zip(ys, ye))]
        page = img.crop((0, full[0][0], W2, full[-1][1]))
        page.save(P / "tiles2" / f"{name}_page.png")
        meta2[f"{name}_page"] = [page.width, page.height]
    # on-set screenshots: keep only the photo area, clear of Instagram UI overlays
    for name, box in {"onset_dumbbell": (212, 315, 923, 1570), "onset_stool": (463, 290, 923, 997)}.items():
        c = Image.open(A2 / f"{name}.jpg").convert("RGB").crop(box)
        c.save(P / "onset" / f"{name}.png")
        blurred(P / "onset" / f"{name}.png", P / "blur" / f"{name}.jpg")
        meta2[name] = [c.width, c.height]
    with open(ROOT / "src" / "assets2.ts", "w") as fh:
        fh.write("// generated by prep/prepare_assets.py – pixel sizes of the second-batch assets\n")
        fh.write("export const SIZES: Record<string, [number, number]> = " + json.dumps(meta2) + ";\n")
    print("batch2", len(meta2))
