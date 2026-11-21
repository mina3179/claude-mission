import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { clamp, easeInOutSine, easeOutCubic, lerp, rand, ramp } from "./util";

export const W = 1080;
export const H = 1920;

export const COLORS = {
  ink: "#0d0b0e",
  cream: "#f6efe6",
  peach: "#ffb59a",
  pink: "#ff8fb1",
  gold: "#d8b37a",
  sky: "#8fd3ff",
};

export const FONTS = {
  sans: "'Noto Sans KR', sans-serif",
  serifKr: "'Noto Serif KR', serif",
  didone: "'Bodoni Moda', 'Noto Serif KR', serif",
  garamond: "'Cormorant Garamond', 'Noto Serif KR', serif",
};

/* ---------- Webtoon camera: cover-fit image + keyframed (cx, cy, zoom) move ---------- */
export type Key = { cx: number; cy: number; z: number };
export const Cam: React.FC<{
  src: string;
  w: number;
  h: number;
  a: Key;
  b: Key;
  p: number;
  ease?: (p: number) => number;
  rot?: number;
}> = ({ src, w, h, a, b, p, ease = easeInOutSine, rot = 0 }) => {
  const e = ease(clamp(p));
  const cx = lerp(a.cx, b.cx, e);
  const cy = lerp(a.cy, b.cy, e);
  const s = Math.max(W / w, H / h) * lerp(a.z, b.z, e);
  const x = clamp(W / 2 - cx * s, W - w * s, 0);
  const y = clamp(H / 2 - cy * s, H - h * s, 0);
  return (
    <AbsoluteFill style={{ overflow: "hidden", transform: `rotate(${rot}deg) scale(${rot ? 1.04 : 1})` }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: h,
          transformOrigin: "0 0",
          transform: `translate(${x}px, ${y}px) scale(${s})`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- pre-blurred backdrop (keeps the real photo un-cropped on top) ---------- */
export const BlurBg: React.FC<{ src: string; dim?: number; scale?: number; tint?: string }> = ({
  src,
  dim = 0.45,
  scale = 1.15,
  tint,
}) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <Img
      src={staticFile(src)}
      style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
    />
    {tint ? <AbsoluteFill style={{ background: tint, mixBlendMode: "soft-light" }} /> : null}
    <AbsoluteFill style={{ background: `rgba(10,8,12,${dim})` }} />
  </AbsoluteFill>
);

/* ---------- real photograph, shown whole (contain), with an optional gentle inner push ---------- */
export const PhotoCard: React.FC<{
  src: string;
  w: number;
  h: number;
  cx?: number;
  cy?: number;
  maxW?: number;
  maxH?: number;
  zoom?: number;
  fx?: number;
  fy?: number;
  rot?: number;
  border?: number;
  opacity?: number;
  shadow?: boolean;
  scale?: number;
}> = ({
  src,
  w,
  h,
  cx = W / 2,
  cy = 800,
  maxW = 940,
  maxH = 1180,
  zoom = 1,
  fx = 0.5,
  fy = 0.5,
  rot = 0,
  border = 10,
  opacity = 1,
  shadow = true,
  scale = 1,
}) => {
  const s = Math.min(maxW / w, maxH / h);
  const cw = w * s;
  const ch = h * s;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - cw / 2 - border,
        top: cy - ch / 2 - border,
        width: cw,
        height: ch,
        border: border ? `${border}px solid ${COLORS.cream}` : undefined,
        overflow: "hidden",
        boxShadow: shadow ? "0 40px 90px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.35)" : undefined,
        transform: `rotate(${rot}deg) scale(${scale})`,
        opacity,
        background: "#000",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: cw,
          height: ch,
          display: "block",
          transformOrigin: `${fx * 100}% ${fy * 100}%`,
          transform: `scale(${zoom})`,
        }}
      />
    </div>
  );
};

/* ---------- small portfolio artwork (pre-upscaled x3 with Lanczos) ---------- */
export const TILE_W = 234;
export const TILE_H = 311;
export const tileSrc = (id: string) => `tiles_x3/${id}.png`;
export const tileBlur = (id: string) => `blur/${id}.jpg`;

/* ---------- city-pop light leaks ---------- */
export const LightLeak: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0.001) return null;
  const x1 = 30 + 25 * Math.sin(t * 0.55);
  const y1 = 18 + 12 * Math.cos(t * 0.37);
  const x2 = 75 + 20 * Math.cos(t * 0.43 + 1);
  const y2 = 82 + 10 * Math.sin(t * 0.5);
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: amount, pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at ${x1}% ${y1}%, rgba(255,160,120,0.55), rgba(255,120,160,0.18) 45%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 40% at ${x2}% ${y2}%, rgba(120,200,255,0.35), rgba(160,120,255,0.12) 50%, transparent 72%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- anamorphic lens flare ---------- */
export const Flare: React.FC<{ x: number; y: number; k: number }> = ({ x, y, k }) => {
  if (k <= 0.001) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: k, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x - 260,
          top: y - 260,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,248,235,0.95) 0%, rgba(255,210,170,0.45) 18%, rgba(255,170,140,0.12) 45%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 900,
          top: y - 14,
          width: 1800,
          height: 28,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(255,235,220,0.8), rgba(150,200,255,0.25) 40%, transparent 70%)",
        }}
      />
      {[0.55, 1.25, 1.7].map((f, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: lerp(x, W - x, f) - 40 * (i + 1),
            top: lerp(y, H - y, f) - 40 * (i + 1),
            width: 80 * (i + 1),
            height: 80 * (i + 1),
            borderRadius: "50%",
            background: `radial-gradient(circle, transparent 40%, ${["rgba(255,180,150,0.18)", "rgba(140,200,255,0.14)", "rgba(255,220,160,0.12)"][i]} 60%, transparent 72%)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/* ---------- sparkle (4-point star) ---------- */
export const Sparkle: React.FC<{ x: number; y: number; size: number; o: number; rot?: number }> = ({
  x,
  y,
  size,
  o,
  rot = 0,
}) =>
  o <= 0.01 ? null : (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, opacity: o, transform: `rotate(${rot}deg)`, mixBlendMode: "screen" }}
    >
      <defs>
        <radialGradient id="sg">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#ffd9c2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="22" fill="url(#sg)" />
      <path d="M0,-50 C4,-6 6,-4 50,0 C6,4 4,6 0,50 C-4,6 -6,4 -50,0 C-6,-4 -4,-6 0,-50Z" fill="#fffaf2" />
    </svg>
  );

/* ---------- drifting bokeh for the ending ---------- */
export const Bokeh: React.FC<{ t: number; n?: number; o?: number }> = ({ t, n = 18, o = 1 }) => (
  <AbsoluteFill style={{ opacity: o, mixBlendMode: "screen" }}>
    {Array.from({ length: n }).map((_, i) => {
      const r = 20 + rand(i + 3) * 70;
      const x = rand(i) * W + Math.sin(t * 0.3 + i) * 30;
      const y = ((rand(i + 9) * H - t * (10 + rand(i + 5) * 25)) % H + H) % H;
      const a = 0.05 + rand(i + 17) * 0.12;
      const c = i % 3 === 0 ? "255,190,150" : i % 3 === 1 ? "255,220,180" : "180,210,255";
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x - r,
            top: y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${c},${a}) 0%, rgba(${c},${a * 0.6}) 55%, transparent 72%)`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

/* ---------- film grain + vignette ---------- */
export const Grain: React.FC<{ frame: number; o?: number }> = ({ frame, o = 0.07 }) => (
  <AbsoluteFill style={{ opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <Img src={staticFile(`fx/grain${frame % 8}.png`)} style={{ width: "100%", height: "100%" }} />
  </AbsoluteFill>
);

export const Vignette: React.FC<{ k?: number }> = ({ k = 0.5 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 62% at 50% 46%, transparent 55%, rgba(0,0,0,${k}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/* ---------- shutter flash + curtain ---------- */
export type FlashEv = { t: number; a: number; d: number; curtain?: boolean };
export const Flash: React.FC<{ t: number; events: FlashEv[] }> = ({ t, events }) => {
  let o = 0;
  let close = 0;
  for (const ev of events) {
    if (t >= ev.t - 0.07 && t < ev.t) o = Math.max(o, ev.a * ramp(t, ev.t - 0.07, ev.t));
    if (t >= ev.t) o = Math.max(o, ev.a * Math.exp(-(t - ev.t) / ev.d));
    if (ev.curtain) {
      if (t >= ev.t - 0.1 && t < ev.t) close = Math.max(close, ramp(t, ev.t - 0.1, ev.t - 0.02));
      if (t >= ev.t && t < ev.t + 0.12) close = Math.max(close, 1 - easeOutCubic(ramp(t, ev.t + 0.0, ev.t + 0.12)));
    }
  }
  return (
    <>
      {close > 0.001 ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: (H / 2) * close, background: "#050405" }} />
          <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: (H / 2) * close, background: "#050405" }} />
        </AbsoluteFill>
      ) : null}
      {o > 0.004 ? <AbsoluteFill style={{ background: "#fffaf3", opacity: Math.min(1, o), pointerEvents: "none" }} /> : null}
    </>
  );
};
