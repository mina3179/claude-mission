/* =========================================================================
 * core.js — 공통 유틸: 이징, 타이밍, 색상, 도형, 키네틱 타이포그래피
 * 모든 애니메이션은 "시간 t(초)"만으로 결정되는 순수 함수라서
 * 어떤 프레임이든 독립적으로 렌더링할 수 있습니다 (병렬 렌더 가능).
 * ========================================================================= */

const W = 1080, H = 1920, FPS = 30, DURATION = 30;

/* ---------- 팔레트 (파스텔 + 레퍼런스의 딥틸 라인) ---------- */
const C = {
  cream:   '#FFF6E6',
  cream2:  '#FFEBCB',
  yellow:  '#FFD25E',
  yellowL: '#FFE9A3',
  mint:    '#7FD9C4',
  mintL:   '#C9F0E4',
  mintD:   '#3FB8A2',
  teal:    '#3BBFB6',
  coral:   '#FF8B7B',
  coralL:  '#FFC4B8',
  peach:   '#FFDCCB',
  sky:     '#BDE8F0',
  ink:     '#22474B',   // 레퍼런스처럼 짙은 청록 라인
  inkSoft: '#4E6E70',
  white:   '#FFFFFF',
  skin:    '#FFDDBF',
  cheek:   '#FF9F95',
  hair:    '#3B2F2C',
  navy:    '#3E5873',
  gray:    '#D7DEDC',
  tire:    '#2F4547',
};
const LW = 7; // 기본 라인 두께

/* ---------- 수학 / 이징 ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  linear: t => clamp(t),
  inQuad: t => (t = clamp(t), t * t),
  outQuad: t => (t = clamp(t), 1 - (1 - t) * (1 - t)),
  inOut: t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => (t = clamp(t), 1 - Math.pow(1 - t, 3)),
  inCubic: t => (t = clamp(t), t * t * t),
  outBack: (t, s = 1.9) => (t = clamp(t) - 1, t * t * ((s + 1) * t + s) + 1),
  inBack: (t, s = 1.7) => (t = clamp(t), t * t * ((s + 1) * t - s)),
  outElastic: t => {
    t = clamp(t);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1;
  },
};
/* 팝업 스케일: t0에 0 → 오버슈트 → 1 */
const popIn = (t, t0, d = .45) => E.outBack(prog(t, t0, t0 + d), 2.4);
const popOut = (t, t0, d = .3) => 1 - E.inBack(prog(t, t0, t0 + d));
/* 통통 튀는 바운스 (지면 착지형) */
const bounce = (t, freq = 2, amp = 1) => Math.abs(Math.sin(t * Math.PI * freq)) * amp;
/* 결정적 의사난수 */
function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/* ---------- 도형 헬퍼 ---------- */
function rr(ctx, x, y, w, h, r) {
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillStroke(ctx, fill, stroke = C.ink, lw = LW) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill, stroke = C.ink, lw = LW) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); fillStroke(ctx, fill, stroke, lw);
}
function ellipse(ctx, x, y, rx, ry, fill, stroke = C.ink, lw = LW, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, Math.PI * 2); fillStroke(ctx, fill, stroke, lw);
}
function line(ctx, pts, color = C.ink, lw = LW) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
/* 외곽선이 있는 굵은 팔다리 */
function limb(ctx, pts, color, w) {
  line(ctx, pts, C.ink, w + LW * 2);
  line(ctx, pts, color, w);
}
/* 하프톤 도트 (레퍼런스 차량 유리창 질감) — 현재 path 안을 채움 */
function dots(ctx, x, y, w, h, gap = 14, r = 2.6, color = C.ink, alpha = .55) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (let j = 0, yy = y; yy < y + h; yy += gap, j++)
    for (let xx = x + (j % 2) * gap / 2; xx < x + w; xx += gap) {
      ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();
}
function star(ctx, x, y, r, fill = C.yellow, stroke = C.ink, lw = 5, points = 5, inner = .48) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points, rr2 = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath(); fillStroke(ctx, fill, stroke, lw);
}
/* 4갈래 반짝이 */
function sparkle(ctx, x, y, r, color = C.white, stroke = C.ink, lw = 4) {
  ctx.beginPath();
  const k = r * .22;
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r); ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r); ctx.closePath();
  fillStroke(ctx, color, stroke, lw);
}
function heart(ctx, x, y, s, fill = C.coral, stroke = C.ink, lw = 5) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * .35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * .35, x - s * .45, y - s * 1.05, x, y - s * .45);
  ctx.bezierCurveTo(x + s * .45, y - s * 1.05, x + s * 1.1, y - s * .35, x, y + s * .35);
  ctx.closePath(); fillStroke(ctx, fill, stroke, lw);
}
/* 점선 경로 (진행률 p 만큼만) */
function dashedPath(ctx, pts, p, color = C.ink, lw = 9, dash = [4, 22]) {
  const segs = []; let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d;
  }
  let remain = total * clamp(p);
  ctx.save(); ctx.setLineDash(dash); ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && remain > 0; i++) {
    const f = Math.min(1, remain / segs[i - 1]);
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
    remain -= segs[i - 1];
  }
  ctx.stroke(); ctx.restore();
}
/* 폴리라인 위 위치 + 방향 */
function pointOnPath(pts, p) {
  let total = 0; const segs = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d; }
  let remain = total * clamp(p);
  for (let i = 1; i < pts.length; i++) {
    if (remain <= segs[i - 1] || i === pts.length - 1) {
      const f = clamp(remain / segs[i - 1]);
      return { x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f),
               dx: pts[i][0] - pts[i - 1][0], dy: pts[i][1] - pts[i - 1][1] };
    }
    remain -= segs[i - 1];
  }
}
/* 변환 헬퍼: (x,y)에서 scale/rotate 후 fn 실행 */
function at(ctx, x, y, s, rot, fn, sy) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.scale(s, sy === undefined ? s : sy); fn(); ctx.restore();
}

/* ---------- 키네틱 타이포그래피 ----------
 * segs: [{t:'문자열', c:'#색', s:1.0(상대크기)}] 또는 문자열
 * 글자 단위로 통통 떨어지며 등장, 강조 세그먼트는 살짝 더 크게 바운스
 */
const FONT_HEAD = 'Jua, "Noto Color Emoji", sans-serif';
const FONT_SUB = 'NanumSquareRound, "Noto Color Emoji", sans-serif';

function kText(ctx, segs, cx, cy, size, t, o = {}) {
  if (typeof segs === 'string') segs = [{ t: segs }];
  const font = o.font || FONT_HEAD, weight = o.weight || '400';
  const stagger = o.stagger ?? .035, dur = o.dur ?? .42;
  const outT = o.out ?? 99;
  const chars = [];
  let total = 0;
  for (const sg of segs) {
    const sz = size * (sg.s || 1);
    ctx.font = `${weight} ${sz}px ${font}`;
    for (const ch of Array.from(sg.t)) {
      const w = ctx.measureText(ch).width * (o.track ?? 1);
      chars.push({ ch, w, sz, c: sg.c || o.color || C.ink, hl: sg.hl, wob: sg.wob });
      total += w;
    }
  }
  let x = o.align === 'left' ? cx : cx - total / 2;
  const outP = E.inBack(prog(t, outT, outT + .3));
  chars.forEach((k, i) => {
    const lt = t - i * stagger;
    if (lt <= 0 || k.ch === ' ') { x += k.w; return; }
    const p = clamp(lt / dur);
    let s = E.outBack(p, 2.6) * (1 - outP);
    let dy = (1 - E.outCubic(p)) * -size * .6;
    if (k.hl) { // 강조: 주기적으로 통통
      const bt = lt - dur;
      if (bt > 0) s *= 1 + .08 * Math.max(0, Math.sin(bt * 7 - i * .5)) * Math.exp(-bt * .9);
    }
    if (k.wob) dy += Math.sin(t * 9 + i) * 4;
    if (s > 0.001) {
      ctx.save(); ctx.translate(x + k.w / 2, cy + dy); ctx.scale(s, s);
      ctx.font = `${weight} ${k.sz}px ${font}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (o.shadow !== false) { // 바닥 그림자 텍스트
        ctx.fillStyle = o.shadowColor || 'rgba(34,71,75,.18)';
        ctx.fillText(k.ch, 0, k.sz * .07 + 4);
      }
      if (o.stroke !== false) {
        ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.strokeStyle = o.strokeColor || C.white; ctx.lineWidth = o.strokeW ?? k.sz * .2;
        ctx.strokeText(k.ch, 0, 0);
      }
      ctx.fillStyle = k.c; ctx.fillText(k.ch, 0, 0);
      ctx.restore();
    }
    x += k.w;
  });
  return total;
}

/* 말풍선/라벨 pill */
function pill(ctx, cx, cy, w, h, fill, stroke = C.ink, lw = LW) {
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); fillStroke(ctx, fill, stroke, lw);
}
function textAt(ctx, str, x, y, size, color = C.ink, font = FONT_HEAD, align = 'center', weight = '400') {
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function textW(ctx, str, size, font = FONT_HEAD, weight = '400') {
  ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(str).width;
}
