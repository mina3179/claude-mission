/* =========================================================================
 * scenes.js — 8개 장면. 각 함수는 (ctx, lt) : lt = 장면 시작 기준 로컬 시간(초)
 * 레이아웃 안전 영역 (인스타 릴스 UI 회피):
 *   상단 0~260px, 하단 1500px 이하, 우측 120px 에는 중요한 자막을 두지 않음
 * ========================================================================= */

const CAP1 = 372, CAP2 = 482;   // 자막 기준 y (2줄)

/* ---------- 공통 배경 ---------- */
function bgSolid(ctx, col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function bgPolka(ctx, t, col, alpha = .5, gap = 120, r = 10, speed = 30) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = col;
  const off = (t * speed) % gap;
  for (let j = -1, y = -gap; y < H + gap; y += gap, j++)
    for (let x = -gap + (j % 2 ? gap / 2 : 0); x < W + gap; x += gap) {
      ctx.beginPath(); ctx.arc(x + off, y + off, r, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();
}
function bgFloor(ctx, y, col = C.cream2) {
  ctx.fillStyle = col; ctx.fillRect(0, y, W, H - y);
  line(ctx, [[-10, y], [W + 10, y]], C.ink, LW);
}
function sunburst(ctx, cx, cy, t, col, n = 16, alpha = .55) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = col; ctx.translate(cx, cy); ctx.rotate(t * .25);
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 2400, i * Math.PI * 2 / n, (i + .5) * Math.PI * 2 / n); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/* 등장 시 통통 튀는 스케일 + 착지 찌그러짐 (squash) */
function landSquash(lt, t0) {
  const p = prog(lt, t0, t0 + .5);
  if (p <= 0) return [0, 0];
  const s = E.outBack(prog(lt, t0, t0 + .32), 2.2);
  const sq = Math.sin(prog(lt, t0 + .2, t0 + .6) * Math.PI) * .12;
  return [s * (1 + sq), s * (1 - sq)];
}
function motionLines(ctx, x, y, n, len, t, col = C.ink, dir = -1) {
  for (let i = 0; i < n; i++) {
    const yy = y + (i - (n - 1) / 2) * 34, ph = (t * 3 + rand(i)) % 1;
    const x0 = x + dir * ph * 80;
    ctx.save(); ctx.globalAlpha *= 1 - ph;
    line(ctx, [[x0, yy], [x0 + dir * len * (1 - ph * .4), yy]], col, 7);
    ctx.restore();
  }
}
function note(ctx, lines, y, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  lines.forEach((s, i) => textAt(ctx, s, 540, y + i * 40, 29, C.inkSoft, FONT_SUB, 'center', '700'));
  ctx.restore();
}

/* =========================================================
 * SCENE 1. 사고는 났는데… (0~4s)
 * ========================================================= */
function scene1(ctx, lt) {
  bgSolid(ctx, C.cream);
  bgPolka(ctx, lt, C.cream2, 1, 130, 12, 18);
  bgFloor(ctx, 1300);

  // 시계 (빠르게 회전)
  const cs = popIn(lt, 1.95);
  if (cs > 0) at(ctx, 225, 770 + Math.sin(lt * 30) * 3 * prog(lt, 2.2, 2.5), cs, Math.sin(lt * 24) * .06, () =>
    drawClock(ctx, 0, 0, 98, lt * lt * .9, 1));

  // 일정 카드가 위에서 떨어지며 쌓임
  const cards = [['09:00', '회의', C.coral], ['11:00', '보고서', C.yellow], ['14:00', '미팅', C.mint], ['18:00', '마감!!', C.coral]];
  cards.forEach(([tm, tt, col], i) => {
    const t0 = 2.15 + i * .3;
    if (lt < t0) return;
    const p = prog(lt, t0, t0 + .38);
    const yEnd = 850 - i * 84;
    const y = lerp(-150, yEnd, E.outCubic(p)) - Math.sin(prog(lt, t0 + .38, t0 + .6) * Math.PI) * 18;
    at(ctx, 700, y, 1, (i % 2 ? 1 : -1) * .05 * (1 - p * .5), () => drawCard(ctx, -205, -42, 410, 86, tm, tt, col));
  });

  // 자동차 (시무룩)
  const [sx, sy] = landSquash(lt, .15);
  if (sx > 0) {
    const sway = Math.sin(lt * 2.2) * .025;
    const blinkT = [1.25, 2.75].reduce((b, t0) => Math.max(b, Math.sin(prog(lt, t0, t0 + .35) * Math.PI)), 0);
    const look = lt > 1.4 ? [Math.sin(prog(lt, 1.4, 1.8) * Math.PI / 2) * 14, 6] : [0, 8];
    at(ctx, 335, 1300, .92 * sx, sway, () => drawCarFront(ctx, {
      t: lt, scratch: 1, face: { eyes: 'sad', mouth: 'frown', blink: blinkT, look, sweat: prog(lt, 2.4, 2.8) },
    }), .92 * sy);
    // 한숨 표시
    if (lt > .8 && lt < 2.2) {
      ctx.save(); ctx.globalAlpha *= Math.sin(prog(lt, .8, 2.2) * Math.PI);
      const yy = 830 - prog(lt, .8, 2.2) * 40;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(150 - i * 22, yy - i * 30, 12 + i * 4, Math.PI * .8, Math.PI * 2.1); fillStroke(ctx, null, C.inkSoft, 5); }
      ctx.restore();
    }
  }

  // 직장인 (슬라이드 등장 → 차를 봄 → 시계 확인 → 당황)
  if (lt > .85) {
    const p = E.outBack(prog(lt, .85, 1.3), 1.6);
    const x = lerp(1250, 830, p);
    const panic = lt > 2.45;
    const watch = lt > 1.85 && !panic;
    const shake = panic ? Math.sin(lt * 70) * 5 : 0;
    const hop = panic ? bounce(lt - 2.45, 3, 22) : bounce(prog(lt, .85, 1.3), 1, 30);
    at(ctx, x + shake, 1300 - hop, .9, 0, () => drawPerson(ctx, {
      t: lt,
      hold: { R: 'briefcase' },
      armL: panic ? { a: 2.2, b: 1.0 } : watch ? { a: .9, b: 1.7 } : { a: .25, b: .15 },
      armR: panic ? { a: 2.2, b: 1.0 } : { a: .2, b: .1 },
      tilt: watch ? -.12 : panic ? Math.sin(lt * 9) * .05 : 0,
      face: panic ? { eyes: 'wide', mouth: 'wavy', sweat: 1, brows: 'worried' }
        : watch ? { eyes: 'dot', mouth: 'o', look: [-12, 10] }
          : { eyes: 'dot', mouth: 'o', look: [-14, 0] },
    }));
    if (panic) { // 놀람 표시
      const s = popIn(lt, 2.5, .3);
      at(ctx, x + 120, 880, s, .2, () => {
        for (let i = 0; i < 3; i++) line(ctx, [[0, 0 + i * 30], [40, -14 + i * 30]], C.coral, 8);
      });
    }
  }

  // 자막
  kText(ctx, [{ t: '사고는 ' }, { t: '났는데...', c: C.coral }], 540, 430, 104, lt - .3, { out: 1.45 });
  kText(ctx, '수리하러 갈', 540, CAP1, 84, lt - 1.9);
  kText(ctx, [{ t: '시간이 없다고요?', c: C.coral, hl: 1 }], 540, CAP2 + 8, 100, lt - 2.15);
}

/* =========================================================
 * SCENE 2. 바쁘다 바빠! (4~8s) — 7.15s에 정지 + 물음표 팡!
 * ========================================================= */
const S2_FREEZE = 3.15;
function scene2(ctx, ltRaw) {
  const frozen = ltRaw >= S2_FREEZE;
  const lt = Math.min(ltRaw, S2_FREEZE);
  bgSolid(ctx, C.yellowL);
  // 속도선 배경
  ctx.save(); ctx.globalAlpha *= .6;
  for (let i = 0; i < 14; i++) {
    const y = 600 + rand(i) * 650, len = 120 + rand(i + 9) * 240;
    const x = W - ((lt * (900 + rand(i + 3) * 700) + rand(i + 5) * W * 2) % (W + len + 400)) + 200;
    line(ctx, [[x, y], [x + len, y]], C.white, 12);
  }
  ctx.restore();
  bgFloor(ctx, 1270, C.yellow);
  // 바닥 대시 (러닝머신처럼 왼쪽으로)
  for (let i = 0; i < 8; i++) {
    const x = ((i * 180 - lt * 900) % 1440 + 1440) % 1440 - 180;
    line(ctx, [[x, 1330], [x + 80, 1330]], C.ink, 8);
  }

  // 아이콘 타일: 출근 / 일 / 집안일
  const tiles = [['office', C.mintL, .2], ['laptop', C.white, 1.2], ['home', C.peach, 2.2]];
  tiles.forEach(([k, col, t0], i) => {
    if (lt < t0) return;
    const s = popIn(lt, t0, .4);
    const outP = i < 2 ? E.inCubic(prog(lt, t0 + .85, t0 + 1.15)) : 0;
    const x = lerp(540, -260, outP);
    at(ctx, x, 780 + Math.sin(lt * 6 + i) * 8, s * 1.15, Math.sin(lt * 5 + i) * .06, () => drawIconTile(ctx, k, 0, 0, 1, col));
    if (outP > 0 && outP < 1) motionLines(ctx, x + 150, 780, 3, 90, lt, C.ink, 1);
  });

  // 생각 풍선 (내 차…)
  const tb = popIn(lt, 2.45, .4);
  if (tb > 0) at(ctx, 840, 930, tb, 0, () => {
    circle(ctx, -110, 110, 12, C.white, C.ink, 5); circle(ctx, -80, 70, 18, C.white, C.ink, 5);
    ellipse(ctx, 0, -10, 120, 95, C.white, C.ink, 6);
    at(ctx, 0, 60, .3, 0, () => drawCarFront(ctx, { scratch: 1, face: { eyes: 'sad', mouth: 'frown' } }));
  });

  // 달리는 직장인
  const ph = lt * Math.PI * 2 * 2.6;
  const run = Math.sin(ph);
  at(ctx, 470, 1275 - Math.abs(Math.sin(ph)) * 26, 1.02, 0, () => drawPerson(ctx, {
    t: lt, lean: .06,
    hold: { R: 'briefcase' },
    armL: { a: .55 + run * .55, b: 1.25 }, armR: { a: .55 - run * .55, b: 1.25 },
    legL: { lift: Math.max(0, run), out: .2 }, legR: { lift: Math.max(0, -run), out: .2 },
    face: lt > 2.2 ? { eyes: 'sad', mouth: 'wavy', sweat: 1 } : { eyes: 'wide', mouth: 'wavy', sweat: 1, look: [6, 0] },
  }));
  if (!frozen) motionLines(ctx, 300, 1050, 4, 110, lt, C.ink, -1);
  // 땀방울 튀김
  for (let i = 0; i < 3; i++) {
    const p = (lt * 2.2 + i / 3) % 1;
    ctx.save(); ctx.globalAlpha *= 1 - p;
    circle(ctx, 560 + i * 30 + p * 90, 860 - p * 50 + p * p * 120, 10, '#9EDCF0', C.ink, 4);
    ctx.restore();
  }

  // 자막 3연타
  kText(ctx, '출근해야지!', 540, 430, 110, lt - .2, { out: .9 });
  kText(ctx, '일해야지!', 540, 430, 110, lt - 1.2, { out: .9 });
  kText(ctx, '내 차는', 540, CAP1, 92, lt - 2.2);
  kText(ctx, [{ t: '언제 고치지? ' }, { t: '😭' }], 540, CAP2 + 6, 92, lt - 2.4);

  // ── 정지! + 물음표 팡
  if (frozen) {
    const ft = ltRaw - S2_FREEZE;
    ctx.save(); ctx.globalAlpha = .25 * prog(ft, 0, .1); ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H); ctx.restore();
    // 정지 테두리 (일시정지 느낌)
    ctx.save(); ctx.globalAlpha *= prog(ft, 0, .08);
    rr(ctx, 36, 300 - 300 + 36, W - 72, H - 72, 60); ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.setLineDash([40, 28]); ctx.stroke();
    ctx.restore();
    const s = E.outElastic(prog(ft, .05, .75));
    at(ctx, 540, 820, s * 1.0, Math.sin(ft * 6) * .08, () => {
      sunburst(ctx, 0, 0, ft, C.yellow, 12, .0);
      circle(ctx, 0, 0, 190, C.coral, C.ink, 10);
      ctx.font = `400 300px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 18; ctx.strokeStyle = C.ink; ctx.strokeText('?', 0, 18);
      ctx.fillStyle = C.white; ctx.fillText('?', 0, 18);
    });
    for (let i = 0; i < 6; i++) { // 팡! 파편
      const a = i * Math.PI / 3 + .3, d = 230 + E.outCubic(prog(ft, .05, .5)) * 90;
      ctx.save(); ctx.globalAlpha *= 1 - prog(ft, .4, .8);
      line(ctx, [[540 + Math.cos(a) * d, 820 + Math.sin(a) * d], [540 + Math.cos(a) * (d + 50), 820 + Math.sin(a) * (d + 50)]], C.ink, 10);
      ctx.restore();
    }
  }
}

/* =========================================================
 * SCENE 3. 걱정 마세요! 사진 견적 (8~12s) — 끝에 폰 화면으로 줌인
 * ========================================================= */
function phoneCamera(ctx, x, y, w, h, lt) {
  ctx.fillStyle = '#2F4547'; ctx.fillRect(x, y, w, h);
  // 카메라 뷰: 긁힌 범퍼 클로즈업
  at(ctx, x + w / 2 + 120, y + h * .78, 1.25, 0, () => drawCarFront(ctx, { scratch: 1, face: { eyes: 'sad', mouth: 'frown', look: [0, 8] } }));
  // 초점 브래킷
  const fx = x + w * .3, fy = y + h * .66, fs = 120 - E.outBack(prog(lt, 1.0, 1.35)) * 30;
  ctx.save(); ctx.strokeStyle = C.yellow; ctx.lineWidth = 8; ctx.lineCap = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath(); ctx.moveTo(fx + sx * fs, fy + sy * fs * .7 - sy * 30);
    ctx.lineTo(fx + sx * fs, fy + sy * fs * .7); ctx.lineTo(fx + sx * fs - sx * 30, fy + sy * fs * .7); ctx.stroke();
  }
  ctx.restore();
  // 상단 라벨
  pill(ctx, x + w / 2, y + 90, 230, 54, 'rgba(255,255,255,.92)', null);
  textAt(ctx, '손상 부위 촬영', x + w / 2, y + 91, 30, C.ink, FONT_SUB, 'center', '700');
  // 셔터 버튼
  const press = Math.sin(prog(lt, 1.42, 1.62) * Math.PI);
  circle(ctx, x + w / 2, y + h - 90, 46, null, C.white, 8);
  circle(ctx, x + w / 2, y + h - 90, 34 - press * 8, C.white, null);
}
function phoneChat(ctx, x, y, w, h, lt) {
  ctx.fillStyle = '#F4FBF9'; ctx.fillRect(x, y, w, h);
  // 헤더
  ctx.fillStyle = C.teal; ctx.fillRect(x, y, w, 150);
  line(ctx, [[x, y + 150], [x + w, y + 150]], C.ink, 5);
  drawLogoMark(ctx, x + 78, y + 98, .42, lt);
  textAt(ctx, '테크노정비 상담', x + 130, y + 100, 34, C.white, FONT_HEAD, 'left');
  // 메시지 1: 사진 전송 (오른쪽)
  const m1 = popIn(lt, 1.85, .4);
  if (m1 > 0) at(ctx, x + w - 150, y + 300, m1, 0, () => {
    rr(ctx, -110, -110, 220, 210, 26); fillStroke(ctx, C.mint, C.ink, 6);
    ctx.save(); rr(ctx, -94, -94, 188, 150, 16); ctx.clip(); ctx.fillStyle = '#2F4547'; ctx.fillRect(-94, -94, 188, 150);
    at(ctx, 30, 40, .4, 0, () => drawCarFront(ctx, { scratch: 1, face: { eyes: 'sad', mouth: 'frown' } }));
    ctx.restore(); rr(ctx, -94, -94, 188, 150, 16); fillStroke(ctx, null, C.ink, 4);
    textAt(ctx, '사진 전송 ✓', 0, 78, 26, C.ink, FONT_SUB, 'center', '700');
  });
  // 메시지 2: 타이핑 → 답장 (왼쪽)
  if (lt > 2.25) {
    const typing = lt < 2.7;
    const s = popIn(lt, 2.25, .3);
    at(ctx, x + 24, y + 470, s, 0, () => {
      if (typing) {
        rr(ctx, 0, -38, 130, 76, 38); fillStroke(ctx, C.white, C.ink, 5);
        for (let i = 0; i < 3; i++) circle(ctx, 36 + i * 30, -bounce(lt * 1.6 - i * .15, 1, 10), 9, C.inkSoft, null);
      } else {
        rr(ctx, 0, -62, w - 70, 124, 30); fillStroke(ctx, C.white, C.ink, 5);
        textAt(ctx, '확인했어요! 예상 견적', 26, -22, 30, C.ink, FONT_SUB, 'left', '700');
        textAt(ctx, '안내드릴게요 😊', 26, 24, 30, C.ink, FONT_SUB, 'left', '700');
      }
    });
  }
  const m3 = popIn(lt, 3.0, .35);
  if (m3 > 0) at(ctx, x + 24, y + 630, m3, 0, () => {
    rr(ctx, 0, -42, w - 110, 84, 30); fillStroke(ctx, C.yellowL, C.ink, 5);
    textAt(ctx, '무료 픽업도 가능해요 🚘', 24, 0, 29, C.ink, FONT_SUB, 'left', '700');
  });
}
function scene3(ctx, lt) {
  bgSolid(ctx, C.mint);
  bgPolka(ctx, lt, C.white, .35, 110, 14, 40);
  // 반짝 별들
  for (let i = 0; i < 6; i++) {
    const s = popIn(lt, .1 + i * .06, .4) * (.7 + .3 * Math.sin(lt * 5 + i));
    const ang = i * Math.PI / 3 + .4;
    if (s > 0) sparkle(ctx, 540 + Math.cos(ang) * 420, 470 + Math.sin(ang) * 150, 26 * s, C.white, C.ink, 4);
  }
  // 자막
  kText(ctx, '걱정 마세요!', 540, 430, 124, lt - .05, { out: 1.7, color: C.ink });
  kText(ctx, [{ t: '📸 ' }, { t: '사진만', c: C.coral, hl: 1 }, { t: ' 보내고' }], 540, CAP1, 86, lt - 1.9);
  kText(ctx, [{ t: '간편 견적 상담!', c: C.ink }], 540, CAP2 + 8, 92, lt - 2.15);

  // 폰 (통통 튀며 등장 → 마지막에 화면 줌인)
  const ps = E.outBack(prog(lt, .45, .95), 1.8);
  if (ps <= 0) return;
  const py = lerp(1700, 1005, ps) + Math.sin(lt * 3) * 6;
  const zoomP = E.inCubic(prog(lt, 3.4, 4.0));
  const z = lerp(1, 4.2, zoomP);
  const pw = 440, ph = 780;
  ctx.save();
  // 줌 중심 = 폰 화면 중앙 → 캔버스 중앙으로 이동하며 확대
  ctx.translate(lerp(540, 540, zoomP), lerp(py, 960, zoomP)); ctx.scale(z, z);
  ctx.rotate(Math.sin(prog(lt, .45, 1.2) * Math.PI * 2) * .05 * (1 - zoomP));
  drawPhone(ctx, 0, 0, pw, ph, (x, y, w, h) => {
    if (lt < 1.7) phoneCamera(ctx, x, y, w, h, lt);
    else phoneChat(ctx, x, y, w, h, lt);
    // 찰칵 플래시
    const fl = 1 - prog(lt, 1.5, 1.85);
    if (lt > 1.5 && fl > 0) { ctx.save(); ctx.globalAlpha = fl; ctx.fillStyle = C.white; ctx.fillRect(x, y, w, h); ctx.restore(); }
    // 줌인 끝 → 다음 장면(지도)이 폰 화면 안에서 나타남
    const mapA = prog(lt, 3.55, 3.95);
    if (mapA > 0) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = mapA; scene4(ctx, 0); ctx.restore();
    }
  });
  ctx.restore();
  // 사진 썸네일이 날아가는 효과
  if (lt > 1.55 && lt < 1.95) {
    const p = E.inOut(prog(lt, 1.55, 1.95));
    at(ctx, lerp(540, 690, p), lerp(py + 80, py - 120, p), lerp(1, .45, p), p * .3, () => {
      rr(ctx, -110, -80, 220, 160, 16); fillStroke(ctx, C.white, C.ink, 6);
    });
  }
  // 카메라 플래시가 화면 전체를 살짝
  const gf = Math.sin(prog(lt, 1.5, 1.75) * Math.PI) * .45;
  if (gf > 0) { ctx.save(); ctx.globalAlpha = gf; ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (lt > 1.9 && zoomP < .05) note(ctx, ['※ 사진 상담은 예상 견적이며,', '차량 점검 후 최종 견적이 달라질 수 있습니다.'], 1432, prog(lt, 1.9, 2.3));
}

/* =========================================================
 * SCENE 4. 원하는 장소로 무료 픽업! (12~15.4s) — 지도 + 점선 경로
 * ========================================================= */
const MAP = { x: 70, y: 590, w: 940, h: 820 };
const ROUTE = [[250, 1250], [250, 1005], [800, 1005], [800, 770]];
function drawMap(ctx, lt) {
  const { x, y, w, h } = MAP;
  ctx.save(); ctx.globalAlpha *= .15; rr(ctx, x + 14, y + 18, w, h, 56); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
  rr(ctx, x, y, w, h, 56); fillStroke(ctx, '#FFF3DC', C.ink, 8);
  ctx.save(); rr(ctx, x, y, w, h, 56); ctx.clip();
  // 공원/강
  ellipse(ctx, 560, 1210, 190, 110, C.mintL, C.ink, 5);
  ellipse(ctx, 420, 760, 150, 95, C.mintL, C.ink, 5);
  ctx.beginPath(); ctx.moveTo(x, 650); ctx.quadraticCurveTo(250, 600, 360, 560); ctx.lineTo(x, 560); ctx.closePath(); fillStroke(ctx, C.sky, C.ink, 5);
  // 도로
  const roads = [[[x - 20, 770], [x + w + 20, 770]], [[x - 20, 1005], [x + w + 20, 1005]], [[x - 20, 1250], [x + w + 20, 1250]],
                 [[250, y - 20], [250, y + h + 20]], [[800, y - 20], [800, y + h + 20]]];
  for (const r of roads) line(ctx, r, C.ink, 70);
  for (const r of roads) line(ctx, r, C.white, 56);
  for (const r of roads) { ctx.save(); ctx.setLineDash([20, 26]); line(ctx, r, C.gray, 5); ctx.restore(); }
  // 블록 건물
  const blds = [[110, 820, C.yellowL], [330, 830, C.coralL], [600, 830, C.yellowL], [870, 830, C.mintL], [110, 1060, C.peach], [880, 1060, C.yellowL], [340, 1080, C.coralL], [880, 650, C.coralL], [600, 640, C.yellowL]];
  blds.forEach(([bx, by, col], i) => {
    const s = popIn(lt, .1 + i * .04, .35);
    if (s > 0) at(ctx, bx + 45, by + 45, s, 0, () => { rr(ctx, -45, -45, 90, 90, 16); fillStroke(ctx, col, C.ink, 5); });
  });
  for (const [tx, ty] of [[520, 1180], [610, 1240], [400, 740], [460, 790], [700, 1160]]) at(ctx, tx, ty, .38, 0, () => drawTree(ctx, 0, 0));
  ctx.restore();
}
function scene4(ctx, lt) {
  bgSolid(ctx, C.peach);
  // 사선 스트라이프
  ctx.save(); ctx.globalAlpha *= .35; ctx.strokeStyle = C.white; ctx.lineWidth = 40;
  const off = (lt * 60) % 120;
  for (let i = -20; i < 30; i++) { ctx.beginPath(); ctx.moveTo(i * 120 + off, 0); ctx.lineTo(i * 120 + off - H * .6, H); ctx.stroke(); }
  ctx.restore();
  drawMap(ctx, lt);

  // 픽업 차량(테크노) : B → A
  const back = ROUTE.slice().reverse();
  const pPick = E.inOut(prog(lt, .55, 1.55));
  // 고객 차량 : A → B
  const pGo = E.inOut(prog(lt, 1.95, 3.05));
  // 경로 점선
  if (lt > .5) dashedPath(ctx, back, pPick, C.mintD, 12, [2, 26]);
  if (lt > 1.95) dashedPath(ctx, ROUTE, pGo, C.coral, 14, [2, 26]);

  // 핀
  const pa = popIn(lt, .2), pb = popIn(lt, .35);
  if (pa > 0) {
    drawPin(ctx, 250, 1250, pa * 1.1, C.coral);
    at(ctx, 250, 1095, pa, 0, () => { pill(ctx, 0, 0, 170, 60, C.white, C.ink, 5); textAt(ctx, '고객님', 0, 2, 34, C.ink); });
  }
  if (pb > 0) {
    const arrive = Math.sin(prog(lt, 3.05, 3.35) * Math.PI) * .25;
    drawPin(ctx, 800, 770, pb * (1.2 + arrive), C.teal, C.yellow);
    at(ctx, 800, 600, pb, 0, () => { pill(ctx, 0, 0, 230, 60, C.white, C.ink, 5); textAt(ctx, '테크노정비', 0, 2, 34, C.ink); });
  }
  // 차량 토큰
  const token = (pts, p, col, label, t0) => {
    const q = pointOnPath(pts, p);
    let dir = 1;
    for (let k = 0; k < 40; k++) { const r = pointOnPath(pts, clamp(p - k * .01)); if (Math.abs(r.dx) > 1) { dir = Math.sign(r.dx); break; } }
    at(ctx, q.x, q.y + 22, .3, 0, () => drawCarSide(ctx, { color: col, colorL: col === C.mint ? C.mintL : C.yellowL, wheel: lt * 12, bob: bounce(lt, 4, 6), label }), .3);
    // 좌우 방향 전환은 scale로 처리하지 않고 그대로 (측면 귀여움 유지)
  };
  if (lt > .5 && lt < 1.9) {
    ctx.save();
    const q = pointOnPath(back, pPick);
    ctx.translate(q.x, q.y + 30); ctx.scale(-.32, .32);
    drawCarSide(ctx, { color: C.yellow, colorL: C.yellowL, wheel: -lt * 12, bob: bounce(lt, 4, 6), face: { eyes: 'happy' } });
    ctx.restore();
  }
  // 정비사 손 흔들기 (도착)
  if (lt > 1.45 && lt < 2.1) {
    const s = popIn(lt, 1.45, .3) * popOut(lt, 1.85, .25);
    at(ctx, 400, 1190, .42 * s, 0, () => drawPerson(ctx, { outfit: 'mechanic', t: lt, armR: { a: 2.6, b: .3 + Math.sin(lt * 14) * .4 }, face: { eyes: 'happy', mouth: 'grin' } }));
  }
  if (lt > 1.9) {
    const q = pointOnPath(ROUTE, pGo);
    const dir = pGo > .64 || pGo < .22 ? 1 : 1;
    at(ctx, q.x, q.y + 30, .32, 0, () => drawCarSide(ctx, { color: C.mint, wheel: lt * 12, bob: bounce(lt, 4, 6), scratch: 1, face: { eyes: 'normal' } }));
  }

  // 자막 (지도 위)
  kText(ctx, '🚘 원하는 장소로', 540, CAP1, 88, lt - .15);
  kText(ctx, [{ t: '무료 픽업!', c: C.coral, hl: 1 }], 540, CAP2 + 10, 112, lt - .45);
}

/* =========================================================
 * SCENE 5. 수리 기간 무상대차 (15.4~20s)
 * ========================================================= */
function scene5(ctx, lt) {
  bgSolid(ctx, C.peach);
  bgPolka(ctx, lt, C.white, .45, 140, 16, 20);
  // 스크롤되는 도시 배경 (대차 차량이 달리는 동안)
  const drive = E.inCubic(prog(lt, 1.9, 2.6)) * (lt - 1.9);
  const scroll = Math.max(0, lt - 2.2) * 520 + E.inQuad(prog(lt, 1.9, 2.2)) * 60;
  ctx.save(); ctx.translate(-scroll * .35 % 1500, 0);
  for (let k = 0; k < 2; k++) {
    const ox = k * 1500;
    drawBuilding(ctx, ox + 30, 1250, 220, 430, C.cream);
    drawBuilding(ctx, ox + 300, 1250, 180, 560, C.yellowL);
    drawBuilding(ctx, ox + 540, 1250, 260, 380, C.mintL);
    drawBuilding(ctx, ox + 860, 1250, 200, 500, C.coralL);
    drawBuilding(ctx, ox + 1120, 1250, 240, 420, C.cream);
  }
  ctx.restore();
  bgFloor(ctx, 1250, '#BFC9C7');
  line(ctx, [[0, 1330], [W, 1330]], C.ink, 0);
  for (let i = 0; i < 8; i++) { const x = ((i * 200 - scroll) % 1600 + 1600) % 1600 - 200; rr(ctx, x, 1340, 100, 16, 8); fillStroke(ctx, C.white, null); }
  ctx.save(); ctx.translate(-scroll % 600, 0);
  for (let i = 0; i < 4; i++) drawTree(ctx, 150 + i * 600, 1258, .75);
  ctx.restore();

  // A) 정비사가 대차 키 전달 (0.2~1.6)
  if (lt < 2.2) {
    const leave = E.inCubic(prog(lt, 1.6, 2.2));
    const mx = lerp(830, 1350, leave);
    at(ctx, mx, 1370, .82, 0, () => drawPerson(ctx, { outfit: 'mechanic', t: lt,
      armL: lt < .7 ? { a: 1.4, b: .3 } : { a: 2.6, b: .3 + Math.sin(lt * 14) * .4 },
      face: { eyes: 'happy', mouth: 'grin' } }));
    const custHide = prog(lt, 1.35, 1.55);
    if (custHide < 1) {
      const hop = lt > .85 ? bounce(lt - .85, 2.5, 30) : 0;
      at(ctx, 250, 1370 - hop, .82 * (1 - custHide * .3), 0, () => drawPerson(ctx, { t: lt,
        hold: lt > .85 ? { R: 'key' } : {},
        armR: lt > .85 ? { a: 2.5, b: .2 } : { a: .9, b: .6 },
        armL: { a: .3, b: .2 },
        face: lt > .85 ? { eyes: 'happy', mouth: 'grin' } : { eyes: 'dot', mouth: 'o', look: [10, 0] } }), );
    }
    // 키가 포물선으로 날아감
    if (lt > .25 && lt < .9) {
      const p = E.inOut(prog(lt, .25, .9));
      drawKey(ctx, lerp(690, 350, p), lerp(1040, 1000, p) - Math.sin(p * Math.PI) * 220, 1.1, p * 6.28);
    }
  }
  // B) 노란 대차 차량 등장(뿅) → 고객 탑승 → 달리기
  if (lt > 1.15) {
    const [sx, sy] = landSquash(lt, 1.15);
    const driver = ctx2 => at(ctx2, 62, -88, .5, 0, () => drawPerson(ctx2, { t: lt, shadow: false, face: { eyes: 'happy', mouth: 'grin' } }));
    at(ctx, 540, 1320 - bounce(lt, 3, lt > 2.2 ? 8 : 0), .98 * sx, 0, () => drawCarSide(ctx, {
      color: C.yellow, colorL: C.yellowL, wheel: scroll / 56, bob: lt > 2 ? bounce(lt, 3, 5) : 0,
      label: '대차 차량', driver: lt > 1.55 ? driver : null, face: { eyes: 'happy' },
    }), .98 * sy);
    if (lt > 2.2) motionLines(ctx, 230, 1180, 3, 100, lt, C.ink, -1);
    // 일상 아이콘이 퐁퐁
    const icons = [[2.35, 'coffee', 300, 780], [2.7, 'briefcase', 540, 720], [3.05, 'heart', 780, 780]];
    for (const [t0, k, x, y] of icons) {
      const s = popIn(lt, t0, .4);
      if (s <= 0) continue;
      const fy = y + Math.sin(lt * 4 + x) * 10;
      at(ctx, x, fy, s, Math.sin(lt * 3 + x) * .1, () => {
        circle(ctx, 0, 0, 82, C.white, C.ink, 7);
        if (k === 'heart') heart(ctx, 0, 14, 44);
        else drawHandItem(ctx, k, 0, k === 'coffee' ? 18 : -14, 1, lt);
      });
    }
  }

  kText(ctx, '🚙 수리 기간', 540, CAP1, 88, lt - .2);
  kText(ctx, [{ t: '무상대차', c: C.coral, hl: 1 }, { t: '까지!' }], 540, CAP2 + 10, 108, lt - .5);
  note(ctx, ['※ 무상대차는 이용 조건 확인 후 제공됩니다.'], 1450, prog(lt, .9, 1.3));
}

/* =========================================================
 * SCENE 6. 수리 과정도 꼼꼼하게 안내 (20~24s)
 * ========================================================= */
function scene6(ctx, lt) {
  bgSolid(ctx, C.mintL);
  // 벽 판넬
  ctx.save(); ctx.globalAlpha *= .5;
  for (let x = 0; x < W; x += 135) line(ctx, [[x, 560], [x, 1270]], C.white, 6);
  ctx.restore();
  // 간판 (레퍼런스 오마주: ◎ TECHNO)
  rr(ctx, 70, 770, 300, 92, 10); fillStroke(ctx, C.white);
  circle(ctx, 120, 816, 24, null, C.ink, 6); circle(ctx, 120, 816, 10, null, C.ink, 6);
  textAt(ctx, 'TECHNO', 255, 820, 50, C.ink);
  // 공구판
  rr(ctx, 690, 740, 300, 170, 10); fillStroke(ctx, C.white);
  for (let i = 0; i < 6; i++) { line(ctx, [[720 + i * 45, 770], [720 + i * 45, 820 + (i % 3) * 18]], C.teal, 9); circle(ctx, 720 + i * 45, 770, 9, C.white, C.teal, 5); }
  rr(ctx, 720, 860, 240, 26, 8); fillStroke(ctx, C.yellowL, C.ink, 4);
  // 조명
  line(ctx, [[540, 560], [540, 700]], C.ink, 7);
  ctx.beginPath(); ctx.moveTo(480, 750); ctx.quadraticCurveTo(540, 660, 600, 750); ctx.closePath(); fillStroke(ctx, C.white);
  ctx.save(); ctx.globalAlpha *= .8 + .2 * Math.sin(lt * 8); ctx.setLineDash([16, 18]);
  for (const a of [-.5, 0, .5]) line(ctx, [[540 + a * 40, 770], [540 + a * 200, 900]], C.yellow, 8);
  ctx.restore();
  bgFloor(ctx, 1270, C.cream2);
  // 리프트 받침
  rr(ctx, 260, 1240, 560, 40, 12); fillStroke(ctx, C.yellow);
  for (let i = 0; i < 7; i++) { ctx.save(); rr(ctx, 260, 1240, 560, 40, 12); ctx.clip(); line(ctx, [[270 + i * 80, 1282], [300 + i * 80, 1238]], C.ink, 12); ctx.restore(); }

  // 차량: 긁힘이 사라짐
  const fix = prog(lt, 1.35, 2.55);
  const done = lt > 2.7;
  at(ctx, 520, 1245 - (done ? bounce(lt - 2.7, 2.5, 18) * Math.exp(-(lt - 2.7) * 2) : 0), .92, 0, () => drawCarSide(ctx, {
    scratch: 1 - fix, face: { eyes: done ? 'happy' : 'normal', mouth: done ? 'open' : 'smile', blink: lt > .8 && lt < 2.6 ? .9 : 0 },
  }));
  if (done) for (let i = 0; i < 4; i++) {
    const s = popIn(lt, 2.75 + i * .08, .35) * (1 - prog(lt, 3.4, 3.9));
    sparkle(ctx, 760 + Math.cos(i * 1.7) * 90, 1140 + Math.sin(i * 2.3) * 70, 34 * s, C.white, C.ink, 4);
  }
  // 도장 스프레이 입자
  if (lt > 1.3 && lt < 2.6) {
    for (let i = 0; i < 22; i++) {
      const p = (lt * 2.4 + rand(i)) % 1;
      ctx.save(); ctx.globalAlpha *= (1 - p) * .9;
      circle(ctx, lerp(865, 785, p) + (rand(i + 3) - .5) * 40 * p, 1150 + (rand(i + 7) - .5) * 80 * p, 6 + p * 10, [C.mint, C.coralL, C.white][i % 3], null);
      ctx.restore();
    }
  }
  // 정비사 A: 태블릿으로 점검 / 정비사 B: 스프레이 도장
  const thumbs = lt > 2.8;
  at(ctx, 150, 1300 - (thumbs ? bounce(lt - 2.8, 2, 14) : 0), .78, 0, () => drawPerson(ctx, { outfit: 'mechanic', t: lt,
    hold: { R: 'tablet' }, armR: { a: 1.0, b: 1.4 },
    armL: thumbs ? { a: 2.6, b: .2 } : { a: .4 + Math.sin(lt * 6) * .1, b: .8 },
    face: thumbs ? { eyes: 'happy', mouth: 'grin' } : { eyes: 'dot', mouth: 'smile', look: [8, 6] } }));
  at(ctx, 940, 1300, .78, 0, () => drawPerson(ctx, { outfit: 'mechanic', t: lt,
    hold: { L: lt < 2.65 ? 'spray' : null }, armL: { a: 1.35 + Math.sin(lt * 10) * .05, b: .2 },
    armR: lt > 2.8 ? { a: 2.6, b: .3 + Math.sin(lt * 14) * .4 } : { a: .3, b: .3 },
    face: lt > 2.8 ? { eyes: 'happy', mouth: 'grin' } : { eyes: 'dot', mouth: 'smile', look: [-10, 4] } }));

  // 스마트폰 푸시 알림 배너
  const notes = [[.45, '🔍', '차량 상태 확인 완료', '점검 사진 3장 도착'], [1.5, '🔧', '판금·도장 진행 중', '작업 사진 2장 도착'], [2.7, '✅', '수리 완료!', '출고 준비 중이에요']];
  notes.forEach(([t0, ic, a, b], i) => {
    const nxt = notes[i + 1] ? notes[i + 1][0] : 99;
    if (lt < t0 || lt > nxt + .3) return;
    const pin = E.outBack(prog(lt, t0, t0 + .4), 1.5), pout = E.inCubic(prog(lt, nxt - .05, nxt + .25));
    const y = lerp(470, 640, pin) + pout * 80;
    ctx.save(); ctx.globalAlpha *= clamp(pin * 2) * (1 - pout);
    at(ctx, 540, y, 1, 0, () => {
      rr(ctx, -420, -62, 840, 124, 36); fillStroke(ctx, C.white, C.ink, 6);
      rr(ctx, -396, -40, 80, 80, 22); fillStroke(ctx, i === 2 ? C.yellow : C.mint, C.ink, 5);
      textAt(ctx, ic, -356, 2, 44, C.ink, FONT_SUB);
      textAt(ctx, a, -290, -16, 40, C.ink, FONT_HEAD, 'left');
      textAt(ctx, b, -290, 26, 28, C.inkSoft, FONT_SUB, 'left', '700');
      textAt(ctx, '지금', 395, -20, 24, C.inkSoft, FONT_SUB, 'right', '700');
      // 사진 썸네일
      for (let k = 0; k < (i === 2 ? 0 : 2); k++) { rr(ctx, 230 + k * 74, -8, 64, 50, 8); fillStroke(ctx, k ? C.coralL : C.sky, C.ink, 4); }
    });
    ctx.restore();
  });

  // 단계 아이콘: 상태 확인 → 수리 진행 → 완료 알림
  const steps = [[.45, '상태 확인'], [1.5, '수리 진행'], [2.7, '완료 알림']];
  const sx = [230, 540, 850], sy = 1395;
  line(ctx, [[sx[0], sy], [sx[2], sy]], C.white, 16);
  const fillP = lt < 1.5 ? prog(lt, .6, 1.5) * .5 : .5 + prog(lt, 1.6, 2.7) * .5;
  line(ctx, [[sx[0], sy], [lerp(sx[0], sx[2], fillP), sy]], C.coral, 16);
  steps.forEach(([t0, lb], i) => {
    const on = lt > t0, s = on ? 1 + .3 * Math.sin(prog(lt, t0, t0 + .35) * Math.PI) : .85;
    at(ctx, sx[i], sy, s, 0, () => {
      circle(ctx, 0, 0, 46, on ? (i === 2 ? C.yellow : C.coral) : C.white, C.ink, 6);
      if (on) line(ctx, [[-18, 0], [-5, 14], [20, -14]], C.white, 10);
      else textAt(ctx, String(i + 1), 0, 2, 40, C.inkSoft);
    });
    textAt(ctx, lb, sx[i], sy + 80, 36, on ? C.ink : C.inkSoft, FONT_HEAD);
  });
  for (const i of [0, 1]) textAt(ctx, '→', (sx[i] + sx[i + 1]) / 2, sy - 40, 36, C.inkSoft, FONT_SUB, 'center', '700');

  kText(ctx, '🔧 내 차 수리 과정도', 540, CAP1 - 10, 80, lt - .1, { out: .3 + 99 });
  kText(ctx, [{ t: '꼼꼼하게', c: C.coral, hl: 1 }, { t: ' 안내!' }], 540, CAP2 - 4, 96, lt - .35);
}

/* =========================================================
 * SCENE 7. 수리 끝! 딜리버리! (24~27s)
 * ========================================================= */
function scene7(ctx, lt) {
  bgSolid(ctx, '#DDF3F6');
  sunburst(ctx, 540, 1000, lt, C.white, 18, .5);
  // 구름
  for (const [x, y, s] of [[160, 640, 1], [900, 600, .8]]) {
    const xx = x + Math.sin(lt * .8 + x) * 20;
    at(ctx, xx, y, s, 0, () => { ctx.beginPath(); ctx.arc(-50, 10, 40, Math.PI * .5, Math.PI * 1.5); ctx.arc(0, -15, 55, Math.PI, 0); ctx.arc(55, 10, 40, Math.PI * 1.5, Math.PI * .5); ctx.closePath(); fillStroke(ctx, C.white, C.ink, 6); });
  }
  bgFloor(ctx, 1300, '#CDE9C9');
  drawHouse(ctx, 840, 1300, .9);
  drawTree(ctx, 1010, 1300, .7);

  // 반짝이는 차량 도착 (정비사가 운전)
  const arrive = E.outCubic(prog(lt, .0, 1.0));
  const cx = lerp(-400, 330, arrive);
  const brake = Math.sin(prog(lt, .85, 1.25) * Math.PI) * .06;
  const driver = c2 => at(c2, 62, -88, .5, 0, () => drawPerson(c2, { outfit: 'mechanic', t: lt, shadow: false, face: { eyes: 'happy', mouth: 'grin' } }));
  at(ctx, cx, 1330, .95, -brake, () => drawCarSide(ctx, { wheel: arrive * 14, bob: lt < 1 ? bounce(lt, 4, 6) : 0, driver, face: { mouth: 'open' } }));
  if (lt < .9) motionLines(ctx, cx - 300, 1180, 3, 120, lt, C.ink, -1);
  // 반짝반짝
  for (let i = 0; i < 6; i++) {
    const ph = (lt * 1.4 + i / 6) % 1;
    const s = Math.sin(ph * Math.PI) * popIn(lt, .1, .3);
    sparkle(ctx, cx + Math.cos(i * 2.1) * 260, 1120 + Math.sin(i * 1.3) * 130, 36 * s, i % 2 ? C.yellow : C.white, C.ink, 4);
  }
  // 고객: 놀람 → 기쁨
  const surprised = lt > 1.0, joy = lt > 1.75;
  const hop = joy ? bounce(lt - 1.75, 2.4, 40) : surprised ? E.outBack(prog(lt, 1.0, 1.2)) * 20 * (1 - prog(lt, 1.2, 1.5)) : 0;
  at(ctx, 760, 1330 - hop, .82, 0, () => drawPerson(ctx, { t: lt,
    armL: joy ? { a: 2.7, b: .2 } : surprised ? { a: 1.6, b: 1.2 } : { a: .2, b: .1 },
    armR: joy ? { a: 2.7, b: .2 } : surprised ? { a: 1.6, b: 1.2 } : { a: .2, b: .1 },
    face: joy ? { eyes: 'happy', mouth: 'open' } : surprised ? { eyes: 'wide', mouth: 'o', brows: 'up', look: [-10, 0] } : { eyes: 'dot', mouth: 'smile', look: [-12, 0] } }));
  if (surprised && !joy) { const s = popIn(lt, 1.0, .25); at(ctx, 700, 920, s, 0, () => textAt(ctx, '!', 0, 0, 120, C.coral)); }

  // 말풍선
  const bs = popIn(lt, 1.45, .45);
  if (bs > 0) at(ctx, 540, 735, bs, Math.sin(lt * 3) * .015, () => {
    ctx.beginPath(); rr(ctx, -440, -110, 880, 220, 80); fillStroke(ctx, C.white, C.ink, 8);
    ctx.beginPath(); ctx.moveTo(170, 100); ctx.lineTo(230, 200); ctx.lineTo(240, 100); ctx.closePath(); fillStroke(ctx, C.white, C.ink, 8);
    ctx.fillStyle = C.white; ctx.fillRect(168, 86, 76, 20);
    kText(ctx, '어? 정비소에 안 갔는데', 0, -42, 62, lt - 1.55, { stroke: false, shadow: false, stagger: .022 });
    kText(ctx, [{ t: '벌써 끝났네?!', c: C.coral }], 0, 44, 72, lt - 1.9, { stroke: false, shadow: false, stagger: .03 });
  });

  kText(ctx, [{ t: '✨ ' }, { t: '수리 완료!', c: C.ink }], 540, CAP1 - 20, 96, lt - .05, { out: 1.2 });
  kText(ctx, [{ t: '🏠 원하는 장소로' }], 540, CAP1 - 20, 80, lt - 1.35);
  kText(ctx, [{ t: '딜리버리!', c: C.coral, hl: 1 }], 540, CAP2 - 20, 104, lt - 1.55);
}
/* 7장면은 말풍선이 자막 아래에 있으므로 자막을 위로 올림 → 말풍선은 735 */

/* =========================================================
 * SCENE 8. 브랜드 엔딩 (27~30s)
 * ========================================================= */
function scene8(ctx, lt) {
  bgSolid(ctx, C.yellow);
  sunburst(ctx, 540, 1060, lt, C.yellowL, 20, .8);
  // 주변 별/하트/반짝이
  const deco = [['star', 160, 700], ['heart', 920, 690], ['spark', 120, 1020], ['star', 960, 1000], ['heart', 210, 1240], ['spark', 880, 1250], ['spark', 540, 640]];
  deco.forEach(([k, x, y], i) => {
    const s = popIn(lt, .35 + i * .07, .4) * (1 + .12 * Math.sin(lt * 6 + i));
    if (s <= 0) return;
    const yy = y + Math.sin(lt * 3 + i) * 14;
    at(ctx, x, yy, s, Math.sin(lt * 2 + i) * .2, () => {
      if (k === 'star') star(ctx, 0, 0, 52, C.white, C.ink, 6);
      else if (k === 'heart') heart(ctx, 0, 10, 50, C.coral, C.ink, 6);
      else sparkle(ctx, 0, 0, 44, C.white, C.ink, 5);
    });
  });
  // 메인 자동차 캐릭터
  const [sx, sy] = landSquash(lt, .05);
  const hop = lt > .6 ? bounce(lt - .6, 1.6, 26) : 0;
  const blink = Math.sin(prog(lt, 2.0, 2.25) * Math.PI);
  if (sx > 0) at(ctx, 540, 1245 - hop, 1.12 * sx, Math.sin(lt * 3.2) * .03, () =>
    drawCarFront(ctx, { t: lt, face: { eyes: lt > .5 ? 'happy' : 'normal', mouth: 'open', blink: lt > .5 ? 0 : blink } }), 1.12 * sy);
  // 브랜드 배지
  const bs = popIn(lt, .85, .45);
  if (bs > 0) at(ctx, 540, 1300, bs, 0, () => {
    rr(ctx, -440, -70, 880, 140, 70); fillStroke(ctx, C.white, C.ink, 8);
    drawLogoMark(ctx, -360, 0, .72, lt);
    textAt(ctx, '김해', -265, 2, 46, C.mintD, FONT_HEAD, 'left');
    textAt(ctx, '테크노자동차정비', -160, 2, 64, C.ink, FONT_HEAD, 'left');
  });
  // CTA
  const cs = popIn(lt, 1.3, .45);
  if (cs > 0) {
    const pulse = 1 + .03 * Math.sin(Math.max(0, lt - 1.8) * 8);
    at(ctx, 540, 1438, cs * pulse, 0, () => {
      rr(ctx, -460, -46, 920, 92, 46); fillStroke(ctx, C.coral, C.ink, 7);
      textAt(ctx, '📸 사고수리, 사진부터 보내고 상담하세요!', 0, 3, 40, C.white, FONT_HEAD);
    });
  }
  kText(ctx, [{ t: '내 차는 ' }, { t: '수리 중!', c: C.mintD }], 540, CAP1, 98, lt - .1);
  kText(ctx, [{ t: '내 일상은 ' }, { t: '그대로!', c: C.coral, hl: 1 }], 540, CAP2 + 12, 98, lt - .45);
}
