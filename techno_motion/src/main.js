/* =========================================================================
 * main.js — 타임라인, 장면 전환, 효과음 큐, 미리보기 플레이어
 * ========================================================================= */

/* 장면 타임라인: start = 장면 시작(초), trans = 이 장면으로 들어오는 전환 */
const TIMELINE = [
  { name: 'S1 사고는 났는데',   draw: scene1, start: 0 },
  { name: 'S2 바쁘다 바빠',     draw: scene2, start: 4,    trans: { type: 'wave', dur: .55 } },
  { name: 'S3 사진 견적',       draw: scene3, start: 8,    trans: { type: 'iris', dur: .6, cx: 540, cy: 820 } },
  { name: 'S4 무료 픽업',       draw: scene4, start: 12,   trans: { type: 'cut' } },          // S3 끝의 폰 줌인이 전환 역할
  { name: 'S5 무상대차',        draw: scene5, start: 15.4, trans: { type: 'carWipe', dur: .7 } },
  { name: 'S6 수리 과정 안내',  draw: scene6, start: 20,   trans: { type: 'stripes', dur: .6 } },
  { name: 'S7 딜리버리',        draw: scene7, start: 24,   trans: { type: 'star', dur: .65 } },
  { name: 'S8 브랜드 엔딩',     draw: scene8, start: 27,   trans: { type: 'iris', dur: .5, cx: 330, cy: 1150 } },
];

/* 효과음 큐 (audio/make_audio.py 가 이 목록을 읽어 믹싱) — [시간, 종류, 볼륨] */
const SFX = [
  [0.15, 'boing', 1], [0.88, 'boing', .8], [1.95, 'pop', .6],
  [2.15, 'tick', .5], [2.45, 'tick', .5], [2.75, 'tick', .5], [3.05, 'tick', .5], [2.5, 'pop', .5],
  [3.98, 'whoosh', .55], [4.2, 'pop', .7], [5.2, 'pop', .7], [6.2, 'pop', .7],
  [7.15, 'stop', .9], [7.2, 'pop', 1.2],
  [8.0, 'whoosh', .5], [8.05, 'sparkle', .6], [8.45, 'boing', .9],
  [9.45, 'shutter', 1.1], [9.85, 'pop', .7], [10.25, 'pop', .55], [10.7, 'pop', .55], [11.0, 'pop', .5],
  [11.4, 'whoosh', .7],
  [12.2, 'pop', .6], [12.35, 'pop', .6], [13.45, 'pop', .4], [15.05, 'sparkle', .45],
  [15.4, 'swoosh', 1.0],
  [15.7, 'sparkle', .4], [16.55, 'boing', .9],
  [17.75, 'pop', .5], [18.1, 'pop', .5], [18.45, 'pop', .5],
  [19.98, 'whoosh', .55], [20.45, 'pop', .6], [21.3, 'spray', .55], [21.5, 'pop', .6], [22.7, 'ding', .8],
  [24.0, 'sparkle', 1.0], [25.0, 'boing', .8], [25.45, 'pop', .6],
  [27.0, 'whoosh', .5], [27.05, 'boing', .8], [27.85, 'pop', .7], [28.3, 'sparkle', .9],
];

/* ---------- 전환 마스크 ---------- */
function transMask(ctx, tr, p) {
  ctx.beginPath();
  if (tr.type === 'wave') {
    const y0 = lerp(H + 120, -140, E.inOut(p));
    ctx.moveTo(-10, H + 10); ctx.lineTo(-10, y0);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 90 + p * 10) * 46);
    ctx.lineTo(W + 10, H + 10); ctx.closePath();
  } else if (tr.type === 'iris') {
    ctx.arc(tr.cx, tr.cy, Math.max(.1, E.inCubic(p) * 1500), 0, Math.PI * 2);
  } else if (tr.type === 'carWipe') {
    ctx.rect(-20, -20, carWipeX(p) - 230, H + 40);
  } else if (tr.type === 'stripes') {
    for (let k = 0; k < 7; k++) {
      const q = E.inOut(prog(p, k * .07, k * .07 + .55));
      const x0 = -700 + k * 360, w = 360 * q + 1;
      ctx.moveTo(x0, H + 20); ctx.lineTo(x0 + 700, -20); ctx.lineTo(x0 + 700 + w, -20); ctx.lineTo(x0 + w, H + 20); ctx.closePath();
    }
  } else if (tr.type === 'star') {
    const R = E.inCubic(p) * 2900, n = 5;
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n + p * 1.2, r = i % 2 ? R * .5 : R;
      ctx.lineTo(540 + Math.cos(a) * r, 1000 + Math.sin(a) * r);
    }
    ctx.closePath();
  }
}
const carWipeX = p => lerp(-420, W + 900, E.inOut(p));
function transOverlay(ctx, tr, p, t) {
  if (tr.type === 'carWipe') {
    const x = carWipeX(p);
    motionLines(ctx, x - 470, 1080, 5, 220, t, C.ink, -1);
    at(ctx, x, 1330, 1.55, -.03, () => drawCarSide(ctx, { wheel: t * 20, bob: bounce(t, 5, 6), scratch: 1, face: { eyes: 'happy', mouth: 'open' } }));
  }
}

/* ---------- 프레임 렌더 ---------- */
function renderAt(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  let idx = 0;
  for (let i = 0; i < TIMELINE.length; i++) if (t >= TIMELINE[i].start) idx = i;
  const cur = TIMELINE[idx], prev = TIMELINE[idx - 1];
  const tr = cur.trans;
  if (prev && tr && tr.type !== 'cut' && t < cur.start + tr.dur) {
    const p = (t - cur.start) / tr.dur;
    prev.draw(ctx, t - prev.start);
    ctx.save(); transMask(ctx, tr, p); ctx.clip();
    cur.draw(ctx, t - cur.start);
    ctx.restore();
    if (tr.type !== 'carWipe') { ctx.save(); transMask(ctx, tr, p); ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
    transOverlay(ctx, tr, p, t);
  } else {
    cur.draw(ctx, t - cur.start);
  }
}

/* ---------- 폰트 로드 (Jua 서브셋 전부) ---------- */
async function loadFonts() {
  await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
  await document.fonts.ready;
}

/* ---------- 진입점 ---------- */
(async function boot() {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  await loadFonts();
  window.SFX = SFX;
  window.TOTAL_FRAMES = FPS * DURATION;
  window.renderFrame = f => renderAt(ctx, f / FPS);
  const params = new URLSearchParams(location.search);
  if (params.has('render')) { document.title = 'ready'; return; }

  // ----- 미리보기 플레이어 -----
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const seek = document.getElementById('seek'), tl = document.getElementById('time'), btn = document.getElementById('play');
  const audio = document.getElementById('audio');
  let playing = false, t = +(params.get('t') || 0), last = 0;
  const draw = () => { renderAt(ctx, t); seek.value = t; tl.textContent = t.toFixed(2) + 's  ' + TIMELINE.filter(s => s.start <= t).pop().name; };
  const loop = now => {
    if (playing) {
      t = audio.readyState > 1 && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
      if (t >= DURATION) { t = 0; audio.currentTime = 0; }
      draw();
    }
    last = now; requestAnimationFrame(loop);
  };
  btn.onclick = () => {
    playing = !playing; btn.textContent = playing ? '❚❚' : '▶';
    if (playing) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause();
  };
  seek.oninput = () => { t = +seek.value; audio.currentTime = t; draw(); };
  document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); btn.onclick(); } });
  draw(); requestAnimationFrame(loop);
})();
