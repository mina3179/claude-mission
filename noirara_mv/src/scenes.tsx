import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import {
  BlurBg,
  Bokeh,
  Cam,
  COLORS,
  Flare,
  FONTS,
  H,
  PhotoCard,
  Sparkle,
  tileBlur,
  tileSrc,
  TILE_H,
  TILE_W,
  W,
} from "./components";
import { B, BRAND, LETTER_START, LETTER_STEP } from "./timeline";
import { SIZES } from "./assets2";
import { clamp, easeInCubic, easeInOutCubic, easeInOutSine, easeOutCubic, easeOutExpo, lerp, rand, ramp } from "./util";

const WT = { w: 1086, h: 1448 };
const P655 = { src: "provided_photos/1000127655.jpg", blur: "blur/1000127655.jpg", w: 1052, h: 1536 };
// On-set photo 1000127658 is used in the user-supplied version where the model was redrawn as webtoon
const P658 = { src: "provided_photos/1000127658_webtoon.webp", blur: "blur/1000127658_webtoon.jpg", w: 1024, h: 1536 };
// The user's own photos – used for every single-photo ("hero") shot
type Pic = { src: string; blur: string; w: number; h: number };
const U = (name: string, w: number, h: number): Pic => ({ src: `provided_photos/${name}.jpg`, blur: `blur/${name}.jpg`, w, h });
// second batch: new portfolio tiles (tiles2/) and on-set photos cropped clear of Instagram UI (onset/)
const T2 = (id: string): Pic => ({ src: `tiles2/${id}.png`, blur: `blur/${id}.jpg`, w: SIZES[id][0], h: SIZES[id][1] });
const ONSET_STOOL: Pic = { src: "onset/onset_stool.png", blur: "blur/onset_stool.jpg", w: SIZES.onset_stool[0], h: SIZES.onset_stool[1] };
const ONSET_DUMBBELL: Pic = { src: "onset/onset_dumbbell.png", blur: "blur/onset_dumbbell.jpg", w: SIZES.onset_dumbbell[0], h: SIZES.onset_dumbbell[1] };
const anySrc = (id: string) => (id.startsWith("grid_") ? `tiles2/${id}.png` : tileSrc(id));
const U1 = U("user_01_pink", 1056, 1079);
const U2 = U("user_02_denim", 1037, 1350);
const U3 = U("user_03_black", 923, 1350);
const U4 = U("user_04_pearl", 1079, 1350);

export type Trans = { type: "fade" | "whip" | "push" | "zoom" | "cut"; d: number };
export type Scene = {
  id: string;
  s: number;
  e: number;
  enter?: Trans;
  exit?: Trans;
  leak?: number;
  render: (lt: number, dur: number, t: number) => React.ReactNode;
};

const Caption: React.FC<{ text: string; sub?: string; o: number; y?: number }> = ({ text, sub, o, y = 236 }) => (
  <div style={{ position: "absolute", left: 0, width: W, top: y, textAlign: "center", opacity: o }}>
    <div style={{ fontFamily: FONTS.garamond, fontWeight: 500, fontSize: 30, letterSpacing: "0.42em", color: COLORS.cream, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
      {text}
    </div>
    {sub ? (
      <div style={{ fontFamily: FONTS.garamond, fontStyle: "italic", fontSize: 26, letterSpacing: "0.08em", color: "rgba(246,239,230,0.75)", marginTop: 6 }}>{sub}</div>
    ) : null}
  </div>
);

/* =====================================================================
   WEBTOON OPENING (0 – 15.95s)
   ===================================================================== */
const S01: Scene = {
  id: "S01 mirror",
  s: 0,
  e: B(6),
  exit: { type: "whip", d: 0.2 },
  leak: 0.45,
  render: (lt, dur) => (
    <>
      <Cam src="webtoon/01_mirror_preparation.png" {...WT} a={{ cx: 560, cy: 760, z: 1.04 }} b={{ cx: 612, cy: 470, z: 1.62 }} p={lt / dur} />
      <Flare x={760 + 40 * Math.sin(lt)} y={240} k={0.35} />
    </>
  ),
};

const S02: Scene = {
  id: "S02 enter studio",
  s: B(6),
  e: B(10),
  enter: { type: "whip", d: 0.22 },
  leak: 0.4,
  render: (lt, dur) => (
    <>
      <Cam src="webtoon/02_enter_studio.png" {...WT} a={{ cx: 330, cy: 780, z: 1.12 }} b={{ cx: 520, cy: 600, z: 1.34 }} p={lt / dur} ease={(p) => p} />
      <Flare x={980} y={200 - 40 * (lt / dur)} k={0.4} />
    </>
  ),
};

const S03a: Scene = {
  id: "S03 photographer wide",
  s: B(10),
  e: B(14),
  enter: { type: "zoom", d: 0.35 },
  leak: 0.4,
  render: (lt, dur) => (
    <>
      <Cam src="webtoon/03_photographer_and_model.png" {...WT} a={{ cx: 500, cy: 760, z: 1.0 }} b={{ cx: 560, cy: 720, z: 1.1 }} p={lt / dur} />
      <Flare x={620 - 60 * (lt / dur)} y={150} k={0.45 + 0.2 * Math.sin(lt * 3)} />
    </>
  ),
};

const S03b: Scene = {
  id: "S03 push to smile",
  s: B(14),
  e: B(22),
  enter: { type: "fade", d: 0.25 },
  leak: 0.38,
  render: (lt, dur) => (
    <>
      <Cam src="webtoon/03_photographer_and_model.png" {...WT} a={{ cx: 640, cy: 640, z: 1.22 }} b={{ cx: 680, cy: 520, z: 1.58 }} p={lt / dur} />
      <Flare x={520} y={120} k={0.3} />
    </>
  ),
};

const S04: Scene = {
  id: "S04 relaxed smile",
  s: B(22),
  e: B(30),
  enter: { type: "fade", d: 0.45 },
  leak: 0.42,
  render: (lt, dur) => (
    <>
      <Cam src="webtoon/04_relaxed_smile.png" {...WT} a={{ cx: 520, cy: 900, z: 1.04 }} b={{ cx: 480, cy: 450, z: 1.42 }} p={lt / dur} />
      <Flare x={830} y={180} k={0.35 + 0.35 * ramp(lt, dur - 1.2, dur)} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const bt = B(26 + i) - B(22);
        const o = lt > bt ? Math.exp(-(lt - bt) / 0.35) : 0;
        return <Sparkle key={i} x={200 + rand(i) * 700} y={300 + rand(i + 7) * 800} size={70 + rand(i + 2) * 60} o={o * 0.9} rot={lt * 40} />;
      })}
    </>
  ),
};

/* =====================================================================
   REAL ON-SET (15.95 – 32.39s)
   ===================================================================== */
const R1: Scene = {
  id: "R1 on-set 1000127655",
  s: B(30),
  e: B(38),
  enter: { type: "zoom", d: 0.5 },
  leak: 0.22,
  render: (lt, dur) => (
    <>
      <BlurBg src={P655.blur} dim={0.5} />
      <PhotoCard {...P655} cy={800} zoom={lerp(1, 1.1, easeInOutSine(lt / dur))} fx={0.32} fy={0.55} />
      <Caption text="BEHIND THE LIGHT" sub="on set — no. 01" o={ramp(lt, 0.3, 0.9) * (1 - ramp(lt, dur - 0.3, dur))} y={112} />
      <Flare x={300} y={330} k={0.22} />
    </>
  ),
};

const R2: Scene = {
  id: "R2 on-set 1000127658",
  s: B(38),
  e: B(46),
  enter: { type: "push", d: 0.4 },
  exit: { type: "push", d: 0.4 },
  leak: 0.22,
  render: (lt, dur) => (
    <>
      <BlurBg src={P658.blur} dim={0.5} />
      <PhotoCard {...P658} cy={800} zoom={lerp(1, 1.12, easeInOutSine(lt / dur))} fx={0.6} fy={0.62} />
      <Caption text="BEHIND THE LIGHT" sub="on set — no. 02" o={ramp(lt, 0.3, 0.9) * (1 - ramp(lt, dur - 0.3, dur))} y={112} />
    </>
  ),
};

/* contact sheet with grease-pencil selection */
type Frame = { src: string; w: number; h: number; label: string };
const tileFrame = (id: string, label: string): Frame => ({ src: tileSrc(id), w: TILE_W * 3, h: TILE_H * 3, label });
const t2Frame = (id: string, label: string): Frame => ({ src: `tiles2/${id}.png`, w: SIZES[id][0], h: SIZES[id][1], label });
const LEFT: Frame[] = [tileFrame("1000127649_r1c0", "06A"), t2Frame("grid_b_r2c0", "07A"), tileFrame("1000127645_r2c0", "08A"), tileFrame("1000127645_r1c2", "09A")];
const RIGHT: Frame[] = [tileFrame("1000127645_r0c0", "11A"), t2Frame("grid_a_r2c2", "12A"), tileFrame("1000127649_r2c2", "13A"), tileFrame("1000127647_r0c2", "14A")];
const FW = 430;
const GAP = 84;
const layout = (fr: Frame[]) => {
  let y = 0;
  return fr.map((f) => {
    const h = (FW * f.h) / f.w;
    const r = { ...f, y, dh: h };
    y += h + GAP;
    return r;
  });
};
const Strip: React.FC<{ frames: Frame[]; x: number; offset: number }> = ({ frames, x, offset }) => {
  const items = layout(frames);
  const total = items[items.length - 1].y + items[items.length - 1].dh + GAP;
  return (
    <div style={{ position: "absolute", left: x - FW / 2 - 50, top: offset - 60, width: FW + 100, height: total + 120, background: "#1c1819" }}>
      {Array.from({ length: Math.ceil((total + 120) / 46) }).map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: 14, top: 10 + i * 46, width: 20, height: 28, borderRadius: 4, background: "#0b0909" }} />
          <div style={{ position: "absolute", right: 14, top: 10 + i * 46, width: 20, height: 28, borderRadius: 4, background: "#0b0909" }} />
        </React.Fragment>
      ))}
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <Img src={staticFile(it.src)} style={{ position: "absolute", left: 50, top: 60 + it.y, width: FW, height: it.dh }} />
          <div style={{ position: "absolute", left: 54, top: 60 + it.y + it.dh + 12, fontFamily: FONTS.garamond, fontSize: 26, letterSpacing: "0.2em", color: "#ff9a5c" }}>
            {`▶ ${it.label}   KODAK 400`}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
const R3: Scene = {
  id: "R3 contact sheet",
  s: B(46),
  e: B(54),
  enter: { type: "push", d: 0.4 },
  leak: 0.18,
  render: (lt, dur) => {
    const p = lt / dur;
    const lOff = lerp(-140, -330, easeInOutSine(p));
    const rOff = lerp(-1250, -900, easeInOutSine(p));
    const items = layout(LEFT);
    const sel = items[1];
    // selected frame centre in screen space
    const sx = 285;
    const sy = lOff + sel.y + sel.dh / 2;
    const draw = easeInOutCubic(ramp(lt, 0.9, 1.7));
    const zoom = lerp(1, 1.55, easeInCubic(ramp(lt, 2.7, dur)));
    const rx = FW / 2 + 40;
    const ry = sel.dh / 2 + 40;
    const circ = Math.PI * (rx + ry) * 1.08;
    return (
      <AbsoluteFill style={{ background: "#100d0e" }}>
        <AbsoluteFill style={{ transformOrigin: `${sx}px ${sy}px`, transform: `scale(${zoom}) rotate(${lerp(-2.5, -1, p)}deg)` }}>
          <Strip frames={LEFT} x={285} offset={lOff} />
          <Strip frames={RIGHT} x={795} offset={rOff} />
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <ellipse
              cx={sx}
              cy={sy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke="#ff3b30"
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - draw)}
              transform={`rotate(-4 ${sx} ${sy})`}
              opacity={0.9}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: sx + rx - 40,
              top: sy - ry - 70,
              fontFamily: FONTS.garamond,
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: 64,
              color: "#ff3b30",
              opacity: ramp(lt, 1.6, 1.9),
              transform: "rotate(-8deg)",
            }}
          >
            ✓ this one
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  },
};

/* portfolio wall – the three real profile grids, scrolling up and sparkling */
const GRIDS = [
  { src: "tiles_x3/1000127645_grid.png", w: 709, h: 942 },
  { src: "tiles2/grid_a_page.png", w: SIZES.grid_a_page[0], h: SIZES.grid_a_page[1] },
  { src: "tiles2/grid_b_page.png", w: SIZES.grid_b_page[0], h: SIZES.grid_b_page[1] },
];
const GRID_647 = { src: "tiles_x3/1000127647_grid.png", w: 709, h: 942 };
const R4: Scene = {
  id: "R4 portfolio wall",
  s: B(54),
  e: B(62),
  enter: { type: "fade", d: 0.3 },
  leak: 0.3,
  render: (lt, dur) => {
    const hs = GRIDS.map((g) => (g.h * W) / g.w);
    const total = hs.reduce((a, b) => a + b, 0) + 16 * 2;
    const y = -lerp(0, total - H + 200, Math.pow(clamp(lt / dur), 1.7));
    let acc = 0;
    return (
      <AbsoluteFill style={{ background: "#fff" }}>
        <AbsoluteFill style={{ perspective: 1800 }}>
          <div style={{ position: "absolute", left: 0, top: y, width: W, transform: `rotateX(${lerp(14, 4, lt / dur)}deg) scale(1.08)`, transformOrigin: "50% 0%" }}>
            {GRIDS.map((g, i) => {
              const top = acc;
              acc += hs[i] + 16;
              return <Img key={i} src={staticFile(g.src)} style={{ position: "absolute", left: 0, top, width: W, height: hs[i] }} />;
            })}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,8,12,0.55), rgba(10,8,12,0.05) 30%, rgba(10,8,12,0.05) 65%, rgba(10,8,12,0.6))" }} />
        {Array.from({ length: 16 }).map((_, i) => {
          const bt = B(54) + i * ((B(62) - B(54)) / 16) - B(54);
          const o = lt > bt ? Math.exp(-(lt - bt) / 0.3) : 0;
          return <Sparkle key={i} x={120 + rand(i * 3) * 840} y={260 + rand(i * 5 + 1) * 1200} size={60 + rand(i) * 90} o={o} rot={lt * 60 + i * 20} />;
        })}
        <AbsoluteFill style={{ background: "#fffaf3", opacity: easeInCubic(ramp(lt, dur - 0.5, dur)) * 0.85 }} />
      </AbsoluteFill>
    );
  },
};

/* =====================================================================
   CHORUS (32.39 – 48.65s)
   ===================================================================== */
const VF_PICS = [U1, U2, U3, U4];
// face centre in each photo (source pixels) – the AF box locks onto the face
const VF_FACE = [
  [478, 168],
  [515, 245],
  [470, 425],
  [545, 235],
];
const C1: Scene = {
  id: "C1 viewfinder shots",
  s: B(62),
  e: B(70),
  leak: 0.2,
  render: (lt, _dur, t) => {
    let k = 0;
    for (let i = 0; i < 4; i++) if (t >= B(62 + 2 * i)) k = i;
    const st = B(62 + 2 * k);
    const ll = t - st;
    const pic = VF_PICS[k];
    const af = easeOutCubic(ramp(ll, 0.05, 0.3));
    const shots = 248 - k;
    const vs = Math.min(780 / pic.w, 1060 / pic.h);
    const afx = 540 - (pic.w * vs) / 2 + VF_FACE[k][0] * vs;
    const afy = 820 - (pic.h * vs) / 2 + VF_FACE[k][1] * vs;
    return (
      <>
        <BlurBg src={pic.blur} dim={0.42} scale={1.25} />
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${lerp(1.05, 1, easeOutExpo(ramp(ll, 0, 0.5)))})` }}>
          <PhotoCard {...pic} cy={820} maxW={780} maxH={1060} border={0} zoom={lerp(1, 1.035, ll / 1.0)} />
        </div>
        {/* viewfinder HUD */}
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {[
            [110, 250, 1, 1],
            [970, 250, -1, 1],
            [110, 1390, 1, -1],
            [970, 1390, -1, -1],
          ].map(([x, y, dx, dy], i) => (
            <path key={i} d={`M${x},${y + 70 * dy} L${x},${y} L${x + 70 * dx},${y}`} stroke="rgba(255,255,255,0.85)" strokeWidth={4} fill="none" />
          ))}
          <rect
            x={afx - lerp(110, 70, af)}
            y={afy - lerp(110, 70, af)}
            width={lerp(220, 140, af)}
            height={lerp(220, 140, af)}
            fill="none"
            stroke={af > 0.98 ? "#9dffb0" : "rgba(255,255,255,0.9)"}
            strokeWidth={3}
          />
          <circle cx={150} cy={290} r={10} fill="#ff4d4d" opacity={Math.floor(lt * 4) % 2 ? 1 : 0.35} />
        </svg>
        <div style={{ position: "absolute", left: 180, top: 271, fontFamily: FONTS.garamond, fontSize: 34, letterSpacing: "0.18em", color: "#fff" }}>1/200 · F4.0 · ISO 100</div>
        <div style={{ position: "absolute", right: 130, top: 1330, fontFamily: FONTS.garamond, fontSize: 36, letterSpacing: "0.12em", color: "#fff" }}>[{shots}]</div>
        <div style={{ position: "absolute", left: 140, top: 1330, fontFamily: FONTS.didone, fontSize: 36, color: "#fff" }}>{BRAND}</div>
      </>
    );
  },
};

const Cover: React.FC<{ pic: Pic; issue: string; line: string; ll: number; x: number }> = ({ pic, issue, line, ll, x }) => {
  const e = easeOutExpo(ramp(ll, 0, 0.6));
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: W, height: H }}>
      <BlurBg src={pic.blur} dim={0.4} scale={1.3} tint="linear-gradient(160deg,#ffb59a,#ff8fb1 50%,#8fd3ff)" />
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 168,
          textAlign: "center",
          fontFamily: FONTS.didone,
          fontSize: 140,
          lineHeight: 1,
          color: "#fff",
          letterSpacing: "0.02em",
          textShadow: "0 4px 30px rgba(0,0,0,0.35)",
          opacity: ramp(ll, 0.05, 0.4),
          transform: `translateY(${(1 - easeOutCubic(ramp(ll, 0.05, 0.6))) * -30}px)`,
        }}
      >
        {BRAND}
      </div>
      <div style={{ position: "absolute", left: 0, width: W, top: 330, textAlign: "center", color: "#fff", opacity: ramp(ll, 0.3, 0.7) }}>
        <span style={{ fontFamily: FONTS.garamond, fontSize: 26, letterSpacing: "0.32em" }}>{issue}</span>
        <span style={{ fontFamily: FONTS.garamond, fontStyle: "italic", fontSize: 38, marginLeft: 18 }}>{line}</span>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${(1 - e) * 80}px)` }}>
        <PhotoCard {...pic} cy={880} maxW={740} maxH={900} border={0} rot={(1 - e) * -3} scale={lerp(1.04, 1, e)} zoom={lerp(1, 1.03, ll / 2)} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 560,
          writingMode: "vertical-rl",
          fontFamily: FONTS.garamond,
          fontSize: 24,
          letterSpacing: "0.5em",
          color: "rgba(255,255,255,0.9)",
          opacity: ramp(ll, 0.35, 0.75),
        }}
      >
        BEHIND THE LIGHT
      </div>
    </div>
  );
};
const C2: Scene = {
  id: "C2 magazine covers",
  s: B(70),
  e: B(78),
  leak: 0.2,
  render: (_lt, _dur, t) => {
    const sw = B(74);
    const push = easeInOutCubic(ramp(t, sw - 0.15, sw + 0.3));
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Cover pic={U4} issue="ISSUE No. 01" line="the real you" ll={t - B(70)} x={-push * W} />
        {t > sw - 0.2 ? <Cover pic={U1} issue="ISSUE No. 02" line="found in a click" ll={t - sw} x={(1 - push) * W} /> : null}
      </AbsoluteFill>
    );
  },
};

const MOSAIC = [
  "grid_a_r0c0",
  "grid_a_r0c1",
  "grid_a_r0c2",
  "grid_a_r1c0",
  "grid_a_r1c1",
  "grid_a_r2c0",
  "grid_b_r0c0",
  "grid_b_r0c2",
  "grid_b_r1c0",
  "grid_b_r1c2",
  "grid_b_r2c1",
  "grid_c_r2c2",
];
const POP_ORDER = [4, 1, 9, 6, 0, 11, 3, 8, 2, 10, 5, 7];
const C3: Scene = {
  id: "C3 mosaic count",
  s: B(78),
  e: B(86),
  leak: 0.15,
  render: (lt, dur, t) => {
    const half = (B(86) - B(78)) / 16;
    let count = 0;
    const cells = MOSAIC.map((id, idx) => {
      const order = POP_ORDER.indexOf(idx);
      const pt = B(78) + order * half;
      const ll = t - pt;
      if (ll >= 0) count++;
      const c = idx % 3;
      const r = Math.floor(idx / 3);
      const e = easeOutExpo(ramp(ll, 0, 0.35));
      return (
        <div key={idx} style={{ position: "absolute", left: c * 360, top: r * 480, width: 360, height: 480, overflow: "hidden", background: "#0d0b0e" }}>
          {ll >= 0 ? (
            <>
              <Img src={staticFile(anySrc(id))} style={{ width: 360, height: 480, objectFit: "cover", transform: `scale(${lerp(1.25, 1, e)})`, opacity: e }} />
              <div style={{ position: "absolute", inset: 0, background: "#fffaf3", opacity: Math.exp(-ll / 0.12) * 0.85 }} />
            </>
          ) : null}
        </div>
      );
    });
    return (
      <AbsoluteFill style={{ background: "#0d0b0e" }}>
        <AbsoluteFill style={{ transform: `scale(${lerp(1, 1.06, lt / dur)})` }}>{cells}</AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 0,
            width: W,
            top: 600,
            textAlign: "center",
            fontFamily: FONTS.didone,
            fontStyle: "italic",
            fontSize: 220,
            color: "#fff",
            mixBlendMode: "difference",
            opacity: 0.9 * (1 - ramp(lt, dur - 0.4, dur)),
          }}
        >
          {String(Math.min(count, 10)).padStart(2, "0")}
        </div>
        <div style={{ position: "absolute", left: 0, width: W, top: 880, textAlign: "center", fontFamily: FONTS.garamond, fontSize: 30, letterSpacing: "0.5em", color: "#fff", mixBlendMode: "difference" }}>
          {count >= 10 ? "AND AGAIN" : "SHOTS"}
        </div>
      </AbsoluteFill>
    );
  },
};

const CAROUSEL = ["1000127645_r0c1", "1000127647_r0c1", "1000127647_r1c1", "1000127645_r2c1", "1000127647_r2c1"];
const C4: Scene = {
  id: "C4 Noirara carousel",
  s: B(86),
  e: B(90),
  enter: { type: "zoom", d: 0.4 },
  leak: 0.3,
  render: (lt, dur) => {
    const pos = lerp(0.2, 3.1, easeInOutSine(lt / dur));
    return (
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #3a2630, #120d12 70%)" }}>
        <AbsoluteFill style={{ perspective: 1400 }}>
          {CAROUSEL.map((id, i) => {
            const d = i - pos;
            const x = 540 + d * 470;
            const sc = lerp(1, 0.72, clamp(Math.abs(d)));
            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: x - 270,
                  top: 820 - 360,
                  width: 540,
                  height: 718,
                  transform: `rotateY(${clamp(d, -1.5, 1.5) * -32}deg) scale(${sc})`,
                  zIndex: 100 - Math.round(Math.abs(d) * 10),
                  boxShadow: "0 40px 90px rgba(0,0,0,0.6)",
                  opacity: 1 - clamp(Math.abs(d) - 1.6),
                }}
              >
                <Img src={staticFile(tileSrc(id))} style={{ width: 540, height: 718, objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "#000", opacity: clamp(Math.abs(d) * 0.45, 0, 0.55) }} />
              </div>
            );
          })}
        </AbsoluteFill>
        <Caption text="THE WORKS OF" sub={BRAND} o={ramp(lt, 0.2, 0.6)} y={170} />
      </AbsoluteFill>
    );
  },
};

const C5: Scene = {
  id: "C5 grid zoom-out",
  s: B(90),
  e: B(94),
  leak: 0.2,
  render: (lt, dur) => {
    const g = GRID_647;
    const fitS = (W - 120) / g.w;
    const s = lerp(3.0, fitS, easeInOutCubic(lt / dur));
    // focus on the tile row1 col1 (centre of the page) – it carries the Noirara mark
    const fx = 354;
    const fy = 315 + 155;
    const cy = lerp(fy, g.h / 2, easeInOutCubic(lt / dur));
    return (
      <AbsoluteFill style={{ background: "#f7f2ec" }}>
        <Img
          src={staticFile(g.src)}
          style={{ position: "absolute", left: 0, top: 0, width: g.w, height: g.h, transformOrigin: "0 0", transform: `translate(${540 - fx * s}px, ${800 - cy * s}px) scale(${s})`, boxShadow: "0 30px 80px rgba(0,0,0,0.25)" }}
        />
        <div style={{ position: "absolute", left: 0, width: W, top: 150, textAlign: "center", fontFamily: FONTS.didone, fontSize: 64, color: "#1b1418", opacity: ramp(lt, 0.8, 1.3) }}>{BRAND}</div>
      </AbsoluteFill>
    );
  },
};

/* =====================================================================
   OUTRO (48.65 – end)
   ===================================================================== */
const SEASONS = [
  { pic: T2("grid_a_r1c2"), w: "spring" },
  { pic: T2("grid_c_r0c2"), w: "summer" },
  { pic: T2("grid_a_r2c1"), w: "autumn" },
  { pic: T2("grid_c_r3c2"), w: "winter" },
];
const O1: Scene = {
  id: "O1 seasons",
  s: B(94),
  e: B(98),
  enter: { type: "fade", d: 0.35 },
  leak: 0.3,
  render: (_lt, _dur, t) => (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {SEASONS.map((sn, i) => {
        const st = B(94 + i);
        const o = i === 0 ? 1 : easeInOutSine(ramp(t, st - 0.12, st + 0.18));
        if (t < st - 0.12) return null;
        return (
          <AbsoluteFill key={sn.w} style={{ opacity: o }}>
            <BlurBg src={sn.pic.blur} dim={0.4} scale={1.3} />
            <PhotoCard {...sn.pic} cy={790} maxW={720} maxH={900} border={0} zoom={lerp(1.05, 1, ramp(t, st, st + 1.2))} />
            <div style={{ position: "absolute", left: 0, width: W, top: 1268, textAlign: "center", fontFamily: FONTS.garamond, fontStyle: "italic", fontSize: 58, color: COLORS.cream, letterSpacing: "0.06em" }}>
              {sn.w}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  ),
};

const O2: Scene = {
  id: "O2 on-set onset_stool",
  s: B(98),
  e: B(102),
  enter: { type: "fade", d: 0.3 },
  leak: 0.35,
  render: (lt, dur) => (
    <>
      <BlurBg src={ONSET_STOOL.blur} dim={0.5} tint="linear-gradient(180deg,#ffb59a,#ffd29a)" />
      <PhotoCard {...ONSET_STOOL} cy={905} maxW={900} maxH={960} zoom={lerp(1.0, 1.06, easeInOutSine(lt / dur))} fx={0.5} fy={0.5} />
      <Flare x={850} y={520} k={0.25} />
    </>
  ),
};

const O3: Scene = {
  id: "O3 work + dedication 1",
  s: B(102),
  e: B(106),
  enter: { type: "fade", d: 0.3 },
  leak: 0.22,
  render: (lt, dur) => (
    <>
      <BlurBg src={U3.blur} dim={0.5} scale={1.3} />
      <PhotoCard {...U3} cy={905} maxW={760} maxH={960} border={0} zoom={lerp(1, 1.05, lt / dur)} />
    </>
  ),
};

const O4: Scene = {
  id: "O4 on-set onset_dumbbell + dedication 2",
  s: B(106),
  e: B(110),
  enter: { type: "fade", d: 0.3 },
  leak: 0.22,
  render: (lt, dur) => (
    <>
      <BlurBg src={ONSET_DUMBBELL.blur} dim={0.52} />
      <PhotoCard {...ONSET_DUMBBELL} cy={905} maxH={960} maxW={900} zoom={lerp(1, 1.06, easeInOutSine(lt / dur))} fx={0.3} fy={0.6} />
    </>
  ),
};

/* original logo (the emblem is shown unaltered; a circular mask hides the screenshot's mute icon) */
const LOGO_D = 1536;
const E1: Scene = {
  id: "E1 original logo",
  s: B(110),
  e: 59.9,
  enter: { type: "fade", d: 0.35 },
  leak: 0.12,
  render: (lt, dur) => {
    const disp = 620; // displayed emblem diameter
    const s = disp / 1480;
    const o = easeOutCubic(ramp(lt, 0, 0.7)) * (1 - easeInOutSine(ramp(lt, dur - 0.6, dur)));
    const sc = lerp(0.93, 1.02, easeOutCubic(lt / dur)) * lerp(1, 1.05, ramp(lt, dur - 0.6, dur));
    return (
      <AbsoluteFill style={{ background: "#050405" }}>
        <Bokeh t={lt + 56} n={14} o={0.8} />
        <div
          style={{
            position: "absolute",
            left: 540 - 762 * s,
            top: 640 - 776 * s,
            width: LOGO_D * s,
            height: LOGO_D * s,
            opacity: o,
            transform: `scale(${sc})`,
            transformOrigin: `${762 * s}px ${776 * s}px`,
            filter: `blur(${ramp(lt, dur - 0.6, dur) * 6}px)`,
          }}
        >
          <div style={{ position: "absolute", left: 762 * s - disp / 2, top: 776 * s - disp / 2, width: disp, height: disp, borderRadius: "50%", boxShadow: `0 0 ${60 + 30 * Math.sin(lt * 2.2)}px rgba(255,215,170,0.35)` }} />
          <Img src={staticFile("logo_square.png")} style={{ width: LOGO_D * s, height: LOGO_D * s, clipPath: `circle(${(disp / 2 + 14)}px at ${762 * s}px ${776 * s}px)` }} />
        </div>
      </AbsoluteFill>
    );
  },
};

const E2: Scene = {
  id: "E2 Noirara letters + final line",
  s: 59.45,
  e: 64.9,
  enter: { type: "fade", d: 0.3 },
  leak: 0.1,
  render: (_lt, _dur, t) => {
    const letters = Array.from(BRAND);
    const lineW = 220 * easeInOutCubic(ramp(t, LETTER_START + 7 * LETTER_STEP + 0.1, LETTER_START + 7 * LETTER_STEP + 0.8));
    return (
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 50% at 50% 46%, #2a1c1f 0%, #0b0809 65%, #050405 100%)" }}>
        <Bokeh t={t} n={18} o={0.9} />
        <div style={{ position: "absolute", left: 0, width: W, top: 770, height: 200, display: "flex", justifyContent: "center", alignItems: "baseline" }}>
          {letters.map((ch, i) => {
            const st = LETTER_START + i * LETTER_STEP;
            const p = easeOutCubic(ramp(t, st, st + 0.75));
            const settle = easeInOutCubic(ramp(t, LETTER_START, LETTER_START + 7 * LETTER_STEP + 0.6));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: FONTS.didone,
                  fontWeight: 400,
                  fontSize: 170,
                  lineHeight: 1,
                  color: "#f7ede1",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 46}px)`,
                  filter: `blur(${(1 - p) * 10}px)`,
                  marginRight: lerp(26, 2, settle),
                  textShadow: "0 0 30px rgba(255,210,160,0.25)",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 540 - lineW / 2, top: 1010, width: lineW, height: 2, background: COLORS.gold, opacity: 0.9 }} />
      </AbsoluteFill>
    );
  },
};

export const SCENES: Scene[] = [S01, S02, S03a, S03b, S04, R1, R2, R3, R4, C1, C2, C3, C4, C5, O1, O2, O3, O4, E1, E2];
