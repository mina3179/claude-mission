import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "@fontsource/noto-serif-kr/500.css";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { BlurBg, COLORS, Flash, FlashEv, FONTS, Grain, H, LightLeak, PhotoCard, Vignette, W } from "./components";
import { Scene, SCENES } from "./scenes";
import { B, BRAND, DEDICATION, DEDICATION_OUT, FINAL_LINE, FPS, LYRICS } from "./timeline";
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, ramp } from "./util";

/* ---------------- fonts must be ready before any frame is captured ---------------- */
const ALL_KO = LYRICS.map((l) => l.text).join("") + DEDICATION.map((d) => d.text).join("") + FINAL_LINE;
export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load(`500 48px "Noto Sans KR"`, ALL_KO),
      document.fonts.load(`700 48px "Noto Sans KR"`, ALL_KO),
      document.fonts.load(`500 48px "Noto Serif KR"`, ALL_KO),
      document.fonts.load(`400 48px "Bodoni Moda"`, BRAND + "0123456789"),
      document.fonts.load(`italic 400 48px "Bodoni Moda"`, "0123456789"),
      document.fonts.load(`500 48px "Cormorant Garamond"`, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·[]▶"),
      document.fonts.load(`italic 500 48px "Cormorant Garamond"`, "abcdefghijklmnopqrstuvwxyz"),
      document.fonts.load(`italic 600 48px "Cormorant Garamond"`, "✓ this one"),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [handle]);
};

/* ---------------- scene wrapper: transitions ---------------- */
const pre = (sc: Scene) => (sc.enter?.type === "fade" ? sc.enter.d : 0);
const post = (sc: Scene) => (sc.exit?.type === "push" ? sc.exit.d : 0);

const SceneWrap: React.FC<{ sc: Scene; t: number }> = ({ sc, t }) => {
  let opacity = 1;
  let tx = 0;
  let ty = 0;
  let scale = 1;
  let blur = 0;
  const { s, e } = sc;
  if (sc.enter) {
    const { type, d } = sc.enter;
    if (type === "fade") opacity *= easeInOutCubic(ramp(t, s - d, s));
    if (type === "whip") {
      const q = 1 - easeOutCubic(ramp(t, s, s + d));
      tx += q * W * 0.7;
      blur += q * 22;
    }
    if (type === "push") ty += (1 - easeInOutCubic(ramp(t, s, s + d))) * H;
    if (type === "zoom") scale *= 1 + (1 - easeOutCubic(ramp(t, s, s + d))) * 0.14;
  }
  if (sc.exit) {
    const { type, d } = sc.exit;
    if (type === "whip") {
      const q = easeInCubic(ramp(t, e - d, e));
      tx -= q * W * 0.7;
      blur += q * 22;
    }
    if (type === "push") ty -= easeInOutCubic(ramp(t, e, e + d)) * H;
  }
  const lt = t - s;
  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        overflow: "hidden",
      }}
    >
      {sc.render(lt, e - s, t)}
    </AbsoluteFill>
  );
};

/* ---------------- lyric subtitles (inside the Reels safe area) ---------------- */
const LYRIC_Y = 1480;
const Lyrics: React.FC<{ t: number }> = ({ t }) => (
  <>
    {LYRICS.map((l, i) => {
      if (t < l.s - 0.01 || t > l.e + 0.25) return null;
      const pin = easeOutCubic(ramp(t, l.s, l.s + 0.28));
      const pout = ramp(t, l.e, l.e + 0.22);
      const o = pin * (1 - pout);
      const chorus = l.text.startsWith("찰칵!");
      return (
        <div key={i} style={{ position: "absolute", left: 60, width: W - 120, top: LYRIC_Y - 60, height: 120, display: "flex", alignItems: "center", justifyContent: "center", opacity: o }}>
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              top: 0,
              bottom: 0,
              background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(8,6,10,0.55), rgba(8,6,10,0) 75%)",
            }}
          />
          <div
            style={{
              position: "relative",
              fontFamily: FONTS.sans,
              fontWeight: 500,
              fontSize: 50,
              letterSpacing: "-0.01em",
              color: "#fff",
              textShadow: "0 2px 16px rgba(0,0,0,0.6), 0 0 3px rgba(0,0,0,0.45)",
              transform: `translateY(${(1 - pin) * 16}px)`,
              whiteSpace: "nowrap",
            }}
          >
            {chorus ? (
              <>
                <span style={{ color: COLORS.peach, fontWeight: 700 }}>찰칵!</span>
                {l.text.slice(3)}
              </>
            ) : (
              l.text
            )}
          </div>
          <div style={{ position: "absolute", left: "50%", top: 6, width: 46 * pin, height: 2, marginLeft: -23 * pin, background: COLORS.peach, opacity: 0.85 }} />
        </div>
      );
    })}
  </>
);

/* ---------------- dedication lines 1 & 2 (sequential) ---------------- */
const Dedication: React.FC<{ t: number }> = ({ t }) => {
  if (t < DEDICATION[0].s - 0.05 || t > DEDICATION_OUT + 0.4) return null;
  const out = 1 - ramp(t, DEDICATION_OUT, DEDICATION_OUT + 0.35);
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: 236, textAlign: "center", opacity: out }}>
      {DEDICATION.map((d, i) => {
        const p = ramp(t, d.s, d.s + 0.8);
        return (
          <div
            key={i}
            style={{
              fontFamily: FONTS.serifKr,
              fontWeight: 500,
              fontSize: 40,
              lineHeight: "64px",
              letterSpacing: "0.01em",
              color: i === 0 ? "#fbf3ea" : "#ffe2c6",
              textShadow: "0 2px 18px rgba(0,0,0,0.7)",
              opacity: easeOutCubic(p),
              transform: `translateY(${(1 - easeOutCubic(p)) * 14}px)`,
              clipPath: `inset(-20px ${(1 - easeInOutCubic(p)) * 100}% -20px 0)`,
            }}
          >
            {d.text}
          </div>
        );
      })}
    </div>
  );
};

/* ---------------- opening title (over scene 01 – no separate intro) ---------------- */
const OpeningTitle: React.FC<{ t: number }> = ({ t }) => {
  if (t > 3.4) return null;
  const o = easeOutCubic(ramp(t, 0.15, 0.8)) * (1 - ramp(t, 2.9, 3.35));
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: 250, textAlign: "center", opacity: o, color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.45)" }}>
      <div style={{ fontFamily: FONTS.didone, fontSize: 76, lineHeight: 1, letterSpacing: lerp(0.16, 0.06, ramp(t, 0.15, 3)) + "em" }}>{BRAND}</div>
      <div style={{ fontFamily: FONTS.garamond, fontWeight: 500, fontSize: 26, letterSpacing: "0.5em", marginTop: 16 }}>BEHIND THE LIGHT</div>
    </div>
  );
};

/* ---------------- shutter flashes on the music ---------------- */
const FLASHES: FlashEv[] = [
  { t: B(14), a: 0.35, d: 0.12 },
  { t: B(30), a: 1, d: 0.32, curtain: true }, // webtoon -> real studio
  { t: B(38), a: 0.25, d: 0.1 },
  { t: B(54), a: 0.3, d: 0.12 },
  { t: B(62), a: 1, d: 0.42, curtain: true }, // "찰칵!"
  { t: B(64), a: 0.75, d: 0.16, curtain: true },
  { t: B(66), a: 0.75, d: 0.16, curtain: true },
  { t: B(68), a: 0.75, d: 0.16, curtain: true },
  { t: B(70), a: 0.6, d: 0.2 },
  { t: B(78), a: 0.5, d: 0.15 },
  { t: B(86), a: 0.55, d: 0.2 },
  { t: B(102), a: 0.18, d: 0.2 },
];

export const MV: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const active = SCENES.filter((sc) => t >= sc.s - pre(sc) && t < sc.e + post(sc));
  // light-leak strength follows the scene on top
  const leak = active.length ? active[active.length - 1].leak ?? 0.2 : 0.2;
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {active.map((sc) => (
        <SceneWrap key={sc.id} sc={sc} t={t} />
      ))}
      <LightLeak t={t} amount={leak} />
      <Vignette k={0.45} />
      <OpeningTitle t={t} />
      <Dedication t={t} />
      <Lyrics t={t} />
      <Flash t={t} events={FLASHES} />
      <Grain frame={frame} o={0.06} />
    </AbsoluteFill>
  );
};

/* ---------------- poster ---------------- */
export const Poster: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <BlurBg src="blur/1000127655.jpg" dim={0.5} />
      <PhotoCard src="provided_photos/1000127655.jpg" w={1052} h={1536} cy={760} maxH={1130} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,6,10,0.65), rgba(8,6,10,0) 22%, rgba(8,6,10,0) 62%, rgba(8,6,10,0.9) 86%)" }} />
      <LightLeak t={3} amount={0.3} />
      <Vignette k={0.4} />
      <div style={{ position: "absolute", left: 0, width: W, top: 1400, textAlign: "center", color: "#f7ede1" }}>
        <div style={{ fontFamily: FONTS.didone, fontSize: 150, lineHeight: 1 }}>{BRAND}</div>
        <div style={{ width: 200, height: 2, background: COLORS.gold, margin: "26px auto 22px" }} />
        <div style={{ fontFamily: FONTS.garamond, fontWeight: 500, fontSize: 32, letterSpacing: "0.5em" }}>BEHIND THE LIGHT</div>
        <div style={{ fontFamily: FONTS.serifKr, fontWeight: 500, fontSize: 34, marginTop: 26, color: "#f3e6d6" }}>{FINAL_LINE}</div>
      </div>
      <Grain frame={3} o={0.05} />
    </AbsoluteFill>
  );
};

export const clampT = clamp;
