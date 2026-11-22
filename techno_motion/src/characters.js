/* =========================================================================
 * characters.js — 캐릭터: 고객(직장인), 정비사, 자동차(정면/측면)
 * 모든 캐릭터는 원점 = 발/바퀴 바닥 중앙. 옵션 객체로 표정·포즈 제어.
 * ========================================================================= */

/* ---------------- 얼굴 ---------------- */
function drawFace(ctx, f, r) {
  const look = f.look || [0, 0];
  const ex = r * .36, ey = r * .08;
  const blink = f.blink || 0; // 0=뜸, 1=감음
  const eyes = blink > .85 ? 'closed' : (f.eyes || 'dot');
  // 볼터치
  if (f.blush !== false) {
    ctx.save(); ctx.globalAlpha *= .55;
    ellipse(ctx, -r * .6, r * .32, r * .17, r * .1, C.cheek, null);
    ellipse(ctx, r * .6, r * .32, r * .17, r * .1, C.cheek, null);
    ctx.restore();
  }
  for (const sd of [-1, 1]) {
    const x = sd * ex + look[0], y = ey + look[1];
    if (eyes === 'dot' || eyes === 'sad') {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 1 - blink * .9);
      ellipse(ctx, 0, 0, r * .1, r * .14, C.ink, null);
      circle(ctx, -r * .03, -r * .05, r * .035, C.white, null);
      ctx.restore();
    } else if (eyes === 'wide') {
      circle(ctx, x, y, r * .19, C.white, C.ink, 5);
      circle(ctx, x + look[0] * .3, y + look[1] * .3, r * .08, C.ink, null);
    } else if (eyes === 'happy') {
      ctx.beginPath(); ctx.arc(x, y + r * .06, r * .12, Math.PI * 1.1, Math.PI * 1.9);
      fillStroke(ctx, null, C.ink, 6);
    } else if (eyes === 'closed') {
      line(ctx, [[x - r * .11, y], [x + r * .11, y]], C.ink, 6);
    } else if (eyes === 'swirl') {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += .2) ctx.lineTo(x + Math.cos(a + f.t * 8) * a * r * .016, y + Math.sin(a + f.t * 8) * a * r * .016);
      fillStroke(ctx, null, C.ink, 4);
    }
  }
  // 눈썹
  if (f.brows === 'worried' || eyes === 'sad') {
    line(ctx, [[-ex - r * .14, ey - r * .2], [-ex + r * .1, ey - r * .3]], C.ink, 5);
    line(ctx, [[ex + r * .14, ey - r * .2], [ex - r * .1, ey - r * .3]], C.ink, 5);
  } else if (f.brows === 'up') {
    line(ctx, [[-ex - r * .1, ey - r * .34], [-ex + r * .1, ey - r * .36]], C.ink, 5);
    line(ctx, [[ex - r * .1, ey - r * .36], [ex + r * .1, ey - r * .34]], C.ink, 5);
  }
  // 입
  const my = r * .4, m = f.mouth || 'smile';
  if (m === 'smile') {
    ctx.beginPath(); ctx.arc(0, my - r * .08, r * .14, Math.PI * .15, Math.PI * .85); fillStroke(ctx, null, C.ink, 5);
  } else if (m === 'grin' || m === 'open') {
    const h = m === 'open' ? r * .2 : r * .16;
    ctx.beginPath(); ctx.moveTo(-r * .17, my - r * .05);
    ctx.quadraticCurveTo(0, my - r * .05 + h * 2, r * .17, my - r * .05); ctx.closePath();
    fillStroke(ctx, '#B5453E', C.ink, 4.5);
    ctx.save(); ctx.clip(); ellipse(ctx, 0, my + h * .9, r * .1, r * .07, C.coral, null); ctx.restore();
  } else if (m === 'frown') {
    ctx.beginPath(); ctx.arc(0, my + r * .1, r * .12, Math.PI * 1.2, Math.PI * 1.8); fillStroke(ctx, null, C.ink, 5);
  } else if (m === 'o') {
    ellipse(ctx, 0, my, r * .07, r * .09, '#B5453E', C.ink, 4.5);
  } else if (m === 'wavy') {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const x = -r * .18 + i * r * .03; ctx.lineTo(x, my + Math.sin(i * 1.6) * r * .035); }
    fillStroke(ctx, null, C.ink, 4.5);
  }
  // 땀방울
  if (f.sweat > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(f.sweat);
    const sy = -r * .15 + ((f.t || 0) * 60 % 30);
    ctx.beginPath(); const x = r * .78, y = sy;
    ctx.moveTo(x, y - r * .2); ctx.quadraticCurveTo(x + r * .14, y + r * .02, x, y + r * .06);
    ctx.quadraticCurveTo(x - r * .14, y + r * .02, x, y - r * .2);
    fillStroke(ctx, '#9EDCF0', C.ink, 4);
    ctx.restore();
  }
}

/* ---------------- 사람 ----------------
 * o.outfit: 'office' | 'mechanic'
 * o.armL/armR: {a: 상완각(0=아래, +=바깥으로 들기), b: 팔꿈치 굽힘}
 * o.legL/legR: {lift: 0..1, out: 벌림}
 * o.hold: {L:'briefcase'|'phone'|..., R:...}
 */
function drawPerson(ctx, o = {}) {
  const t = o.t || 0;
  const mech = o.outfit === 'mechanic';
  const shirt = mech ? C.teal : C.white;
  const pants = mech ? C.teal : C.navy;
  const sleeve = mech ? C.teal : C.white;
  const bob = o.bob || 0;
  const lean = o.lean || 0;

  // 그림자
  if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= .15; ellipse(ctx, 0, 4, 80, 14, C.ink, null); ctx.restore(); }

  // 다리
  for (const [sd, lg] of [[-1, o.legL || {}], [1, o.legR || {}]]) {
    const hx = sd * 26, hy = -118 - bob;
    const lift = lg.lift || 0, out = lg.out || 0;
    const fx = hx + sd * (4 + out * 40), fy = -lift * 55;
    const kx = (hx + fx) / 2 + sd * lift * 28, ky = (hy + fy) / 2 - lift * 10;
    limb(ctx, [[hx, hy], [kx, ky], [fx, fy - 12]], pants, 34);
    ellipse(ctx, fx + sd * 8, fy - 6, 26, 15, mech ? C.ink : '#5A4A44', C.ink, 5);
  }

  ctx.save(); ctx.translate(0, -118 - bob); ctx.rotate(lean); ctx.translate(0, 118);
  // 몸통
  rr(ctx, -62, -240, 124, 140, 40); fillStroke(ctx, shirt);
  if (mech) {
    // 작업복 디테일: 지퍼선 + 가슴 패치
    line(ctx, [[0, -225], [0, -110]], C.ink, 4);
    rr(ctx, 14, -205, 34, 26, 7); fillStroke(ctx, C.yellowL, C.ink, 4);
    line(ctx, [[-60, -120], [60, -120]], C.ink, 4);
  } else {
    // 넥타이
    ctx.beginPath(); ctx.moveTo(-10, -232); ctx.lineTo(10, -232); ctx.lineTo(14, -170); ctx.lineTo(0, -150); ctx.lineTo(-14, -170); ctx.closePath();
    fillStroke(ctx, C.coral, C.ink, 4.5);
    // 칼라
    ctx.beginPath(); ctx.moveTo(-30, -238); ctx.lineTo(-6, -218); ctx.lineTo(-20, -206); ctx.closePath(); fillStroke(ctx, C.white, C.ink, 4);
    ctx.beginPath(); ctx.moveTo(30, -238); ctx.lineTo(6, -218); ctx.lineTo(20, -206); ctx.closePath(); fillStroke(ctx, C.white, C.ink, 4);
    line(ctx, [[-62, -122], [62, -122]], C.ink, 4);
  }

  // 팔
  const arms = [[-1, o.armL || {}, (o.hold || {}).L], [1, o.armR || {}, (o.hold || {}).R]];
  const hands = {};
  for (const [sd, am, item] of arms) {
    const sx = sd * 54, sy = -222;
    const a = am.a ?? .25, b = am.b ?? .15;
    const ex = sx + sd * Math.sin(a) * 58, ey = sy + Math.cos(a) * 58;
    const a2 = a + b;
    const hx = ex + sd * Math.sin(a2) * 56, hy = ey + Math.cos(a2) * 56;
    limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], sleeve, 26);
    hands[sd] = [hx, hy, a2];
    if (item) drawHandItem(ctx, item, hx, hy, sd, t);
    circle(ctx, hx, hy, 15, C.skin, C.ink, 5);
  }

  // 머리
  const hr = 82;
  ctx.save(); ctx.translate(0, -310); ctx.rotate(o.tilt || 0);
  circle(ctx, -hr, 10, 16, C.skin, C.ink, 5); circle(ctx, hr, 10, 16, C.skin, C.ink, 5);
  circle(ctx, 0, 0, hr, C.skin, C.ink, LW);
  if (mech) {
    // 캡 모자
    ctx.beginPath(); ctx.arc(0, -8, hr + 4, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); fillStroke(ctx, C.teal);
    ctx.beginPath(); ctx.ellipse(0, -14, hr * 1.02, 20, 0, 0, Math.PI); fillStroke(ctx, C.mintD);
    circle(ctx, 0, -48, 17, C.yellow, C.ink, 4);
    textAt(ctx, 'T', 0, -47, 22, C.ink);
  } else {
    // 머리카락 (가르마 스타일)
    ctx.beginPath();
    ctx.arc(0, 0, hr + 3, Math.PI * .98, Math.PI * 2.02);
    ctx.quadraticCurveTo(hr * .7, -hr * .2, hr * .35, -hr * .38);
    ctx.quadraticCurveTo(hr * .05, -hr * .15, -hr * .2, -hr * .48);
    ctx.quadraticCurveTo(-hr * .6, -hr * .25, -hr * 1.02, hr * .05);
    ctx.closePath(); fillStroke(ctx, C.hair);
    ctx.save(); ctx.globalAlpha *= .35; ellipse(ctx, -hr * .3, -hr * .7, 18, 7, C.white, null, 0, -.3); ctx.restore();
  }
  drawFace(ctx, Object.assign({ t }, o.face || {}), hr);
  ctx.restore();
  ctx.restore();
  return hands;
}

function drawHandItem(ctx, item, x, y, sd, t) {
  if (item === 'briefcase') {
    rr(ctx, x - 38, y + 6, 76, 56, 10); fillStroke(ctx, C.yellow);
    rr(ctx, x - 14, y - 8, 28, 18, 6); fillStroke(ctx, null, C.ink, 5);
    line(ctx, [[x - 38, y + 26], [x + 38, y + 26]], C.ink, 4);
  } else if (item === 'phone') {
    rr(ctx, x - 20, y - 52, 40, 70, 9); fillStroke(ctx, C.coral);
    rr(ctx, x - 13, y - 45, 26, 46, 5); fillStroke(ctx, C.sky, null);
  } else if (item === 'wrench') {
    at(ctx, x, y, 1, sd * -.6, () => {
      limb(ctx, [[0, 0], [0, -70]], C.gray, 12);
      circle(ctx, 0, -78, 17, C.gray, C.ink, 5);
      rr(ctx, -7, -100, 14, 20, 3); fillStroke(ctx, C.teal, null);
    });
  } else if (item === 'spray') {
    at(ctx, x, y, 1, 0, () => {
      rr(ctx, -10 * sd, -30, sd * 70, 34, 10); fillStroke(ctx, C.coral);
      rr(ctx, sd * 55, -24, sd * 26, 14, 5); fillStroke(ctx, C.gray, C.ink, 4);
      rr(ctx, -10, -70, 34, 42, 8); fillStroke(ctx, C.yellowL, C.ink, 5);
    });
  } else if (item === 'tablet') {
    at(ctx, x, y - 30, 1, sd * .15, () => {
      rr(ctx, -40, -50, 80, 100, 12); fillStroke(ctx, C.white);
      rr(ctx, -30, -40, 60, 70, 6); fillStroke(ctx, C.mintL, null);
      line(ctx, [[-20, -25], [20, -25]], C.mintD, 5); line(ctx, [[-20, -8], [12, -8]], C.mintD, 5);
      line(ctx, [[-20, 9], [16, 9]], C.mintD, 5);
    });
  } else if (item === 'key') {
    drawKey(ctx, x, y - 20, .9, sd * .3, t);
  } else if (item === 'coffee') {
    rr(ctx, x - 20, y - 40, 40, 52, 8); fillStroke(ctx, C.white);
    rr(ctx, x - 20, y - 26, 40, 18, 2); fillStroke(ctx, C.coral, null);
    rr(ctx, x - 23, y - 48, 46, 12, 5); fillStroke(ctx, C.ink, null);
  }
}

/* ---------------- 자동차 (정면, 의인화) ----------------
 * o.color, o.colorL, o.face{eyes:'normal'|'sad'|'happy'|'wide'|'star', mouth, blink, look}
 * o.scratch: 0..1 (범퍼 긁힘 표시)
 */
function drawCarFront(ctx, o = {}) {
  const col = o.color || C.mint, colL = o.colorL || C.mintL;
  const f = o.face || {}, t = o.t || 0;
  // 그림자
  ctx.save(); ctx.globalAlpha *= .16; ellipse(ctx, 0, 2, 250, 22, C.ink, null); ctx.restore();
  // 바퀴
  rr(ctx, -205, -70, 62, 72, 16); fillStroke(ctx, C.tire);
  rr(ctx, 143, -70, 62, 72, 16); fillStroke(ctx, C.tire);
  // 사이드미러
  ellipse(ctx, -228, -258, 30, 20, col, C.ink, LW, -.25);
  ellipse(ctx, 228, -258, 30, 20, col, C.ink, LW, .25);
  // 캐빈
  ctx.beginPath();
  ctx.moveTo(-178, -232); ctx.quadraticCurveTo(-160, -330, -130, -378);
  ctx.quadraticCurveTo(0, -398, 130, -378); ctx.quadraticCurveTo(160, -330, 178, -232); ctx.closePath();
  fillStroke(ctx, col);
  // 앞유리
  ctx.beginPath();
  ctx.moveTo(-148, -245); ctx.quadraticCurveTo(-134, -320, -112, -358);
  ctx.quadraticCurveTo(0, -374, 112, -358); ctx.quadraticCurveTo(134, -320, 148, -245); ctx.closePath();
  fillStroke(ctx, C.sky, C.ink, 6);
  ctx.save(); ctx.clip(); dots(ctx, -150, -380, 300, 140, 15, 2.6, C.ink, .35);
  ctx.globalAlpha *= .8; ctx.fillStyle = C.white;
  ctx.beginPath(); ctx.moveTo(-60, -370); ctx.lineTo(-20, -370); ctx.lineTo(-90, -240); ctx.lineTo(-130, -240); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -370); ctx.lineTo(14, -370); ctx.lineTo(-56, -240); ctx.lineTo(-70, -240); ctx.closePath(); ctx.fill();
  ctx.restore();
  // 하부 바디
  rr(ctx, -238, -262, 476, 212, 78); fillStroke(ctx, col);
  // 범퍼
  rr(ctx, -222, -98, 444, 52, 26); fillStroke(ctx, colL);
  // 번호판
  rr(ctx, -62, -88, 124, 34, 9); fillStroke(ctx, C.white, C.ink, 5);
  textAt(ctx, o.plate || '12가 3456', 0, -70, 21, C.ink, FONT_SUB, 'center', '700');
  // 긁힘
  if (o.scratch > 0) {
    ctx.save(); ctx.globalAlpha *= o.scratch;
    for (let i = 0; i < 3; i++)
      line(ctx, [[-196 + i * 14, -88 + i * 3], [-170 + i * 14, -64 + i * 2], [-176 + i * 14, -56]], '#B5453E', 4.5);
    ctx.restore();
  }
  // 헤드라이트 눈
  const blink = f.blink || 0, eyes = f.eyes || 'normal', look = f.look || [0, 0];
  for (const sd of [-1, 1]) {
    const x = sd * 132, y = -178;
    ctx.save(); ctx.translate(x, y);
    if (eyes === 'happy') {
      ellipse(ctx, 0, 0, 52, 44, C.yellowL, C.ink, LW);
      ctx.beginPath(); ctx.arc(0, 12, 24, Math.PI * 1.1, Math.PI * 1.9); fillStroke(ctx, null, C.ink, 8);
    } else {
      ellipse(ctx, 0, 0, 52, 44, C.white, C.ink, LW);
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 49, 41, 0, 0, Math.PI * 2); ctx.clip();
      const pr = eyes === 'wide' ? 17 : 24;
      if (eyes === 'star') {
        star(ctx, look[0], look[1], 30, C.yellow, C.ink, 4);
      } else {
        circle(ctx, look[0], look[1] + 4, pr, C.ink, null);
        circle(ctx, look[0] - 8, look[1] - 5, 7, C.white, null);
      }
      // 눈꺼풀 (슬픔: 바깥쪽이 처지게 / 깜빡임)
      let lid = blink;
      if (eyes === 'sad') lid = Math.max(lid, .42);
      if (lid > 0) {
        ctx.fillStyle = col; ctx.beginPath();
        const tiltLid = eyes === 'sad' ? sd * .3 : 0;
        ctx.save(); ctx.rotate(tiltLid);
        ctx.rect(-70, -70, 140, 70 + (lid * 2 - 1) * 44); ctx.fill();
        line(ctx, [[-60, (lid * 2 - 1) * 44], [60, (lid * 2 - 1) * 44]], C.ink, 6);
        ctx.restore();
      }
      ctx.restore();
      ellipse(ctx, 0, 0, 52, 44, null, C.ink, LW);
    }
    ctx.restore();
  }
  // 볼터치
  if (f.blush !== false) {
    ctx.save(); ctx.globalAlpha *= .5;
    ellipse(ctx, -150, -118, 26, 13, C.coral, null); ellipse(ctx, 150, -118, 26, 13, C.coral, null);
    ctx.restore();
  }
  // 입(그릴)
  const m = f.mouth || 'smile';
  if (m === 'smile') {
    ctx.beginPath(); ctx.arc(0, -150, 34, Math.PI * .2, Math.PI * .8); fillStroke(ctx, null, C.ink, 7);
  } else if (m === 'frown') {
    ctx.beginPath(); ctx.arc(0, -100, 30, Math.PI * 1.22, Math.PI * 1.78); fillStroke(ctx, null, C.ink, 7);
  } else if (m === 'open' || m === 'grin') {
    const h = m === 'open' ? 40 : 30;
    ctx.beginPath(); ctx.moveTo(-42, -136); ctx.quadraticCurveTo(0, -136 + h * 2, 42, -136); ctx.closePath();
    fillStroke(ctx, '#B5453E', C.ink, 6);
    ctx.save(); ctx.clip(); ellipse(ctx, 0, -136 + h * 1.05, 22, 14, C.coral, null); ctx.restore();
  } else if (m === 'o') {
    ellipse(ctx, 0, -125, 14, 17, '#B5453E', C.ink, 6);
  } else if (m === 'wavy') {
    ctx.beginPath(); for (let i = 0; i <= 10; i++) ctx.lineTo(-36 + i * 7.2, -122 + Math.sin(i * 1.7) * 6); fillStroke(ctx, null, C.ink, 6);
  }
  // 땀
  if (f.sweat > 0) {
    ctx.save(); ctx.globalAlpha *= f.sweat;
    const y = -300 + (t * 50 % 40);
    ctx.beginPath(); ctx.moveTo(205, y - 30); ctx.quadraticCurveTo(226, y + 4, 205, y + 10); ctx.quadraticCurveTo(184, y + 4, 205, y - 30);
    fillStroke(ctx, '#9EDCF0', C.ink, 5); ctx.restore();
  }
}

/* ---------------- 자동차 (측면, 오른쪽을 향함) ----------------
 * o.wheel: 바퀴 회전각, o.bob: 차체 출렁임, o.label: 옆면 문구
 */
function drawCarSide(ctx, o = {}) {
  const col = o.color || C.mint, colL = o.colorL || C.mintL;
  const f = o.face || {}, bob = o.bob || 0, wa = o.wheel || 0;
  ctx.save(); ctx.globalAlpha *= .16; ellipse(ctx, 0, 4, 280, 20, C.ink, null); ctx.restore();
  ctx.save(); ctx.translate(0, -bob);
  // 차체
  ctx.beginPath();
  ctx.moveTo(-270, -78);
  ctx.lineTo(-270, -168); ctx.quadraticCurveTo(-268, -196, -236, -200);
  ctx.lineTo(-180, -206); ctx.quadraticCurveTo(-160, -296, -118, -306);
  ctx.lineTo(70, -308); ctx.quadraticCurveTo(110, -306, 132, -278);
  ctx.lineTo(176, -214); ctx.lineTo(250, -196); ctx.quadraticCurveTo(282, -188, 282, -150);
  ctx.lineTo(282, -84); ctx.quadraticCurveTo(282, -50, 250, -50);
  ctx.lineTo(-240, -50); ctx.quadraticCurveTo(-270, -50, -270, -78); ctx.closePath();
  fillStroke(ctx, col);
  // 하단 스트립
  ctx.save(); ctx.clip(); ctx.fillStyle = colL; ctx.fillRect(-300, -96, 600, 50); ctx.restore();
  line(ctx, [[-268, -96], [280, -96]], C.ink, 5);
  // 창문
  ctx.beginPath(); ctx.moveTo(-158, -210); ctx.quadraticCurveTo(-142, -276, -108, -284); ctx.lineTo(-22, -286); ctx.lineTo(-22, -210); ctx.closePath();
  fillStroke(ctx, C.sky, C.ink, 6); ctx.save(); ctx.clip(); dots(ctx, -170, -300, 160, 100, 15, 2.6, C.ink, .35); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-2, -210); ctx.lineTo(-2, -286); ctx.lineTo(62, -286); ctx.quadraticCurveTo(96, -284, 112, -262); ctx.lineTo(150, -210); ctx.closePath();
  fillStroke(ctx, C.sky, C.ink, 6); ctx.save(); ctx.clip();
  if (o.driver) o.driver(ctx);
  dots(ctx, -10, -300, 170, 100, 15, 2.6, C.ink, .3); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-2, -210); ctx.lineTo(-2, -286); ctx.lineTo(62, -286); ctx.quadraticCurveTo(96, -284, 112, -262); ctx.lineTo(150, -210); ctx.closePath();
  fillStroke(ctx, null, C.ink, 6);
  // 문 라인/손잡이
  line(ctx, [[-12, -206], [-12, -100]], C.ink, 5);
  line(ctx, [[160, -206], [168, -100]], C.ink, 5);
  rr(ctx, -70, -186, 34, 11, 5); fillStroke(ctx, colL, C.ink, 4);
  rr(ctx, 100, -186, 34, 11, 5); fillStroke(ctx, colL, C.ink, 4);
  // 라이트
  ellipse(ctx, 266, -160, 14, 20, C.yellowL, C.ink, 5);
  rr(ctx, -279, -182, 16, 40, 7); fillStroke(ctx, C.coral, C.ink, 5);
  // 문구
  if (o.label) {
    rr(ctx, -150, -156, 290, 46, 23); fillStroke(ctx, C.white, C.ink, 5);
    textAt(ctx, o.label, -5, -132, 30, C.ink, FONT_HEAD);
  }
  // 긁힘(앞 범퍼)
  if (o.scratch > 0) {
    ctx.save(); ctx.globalAlpha *= o.scratch;
    for (let i = 0; i < 3; i++) line(ctx, [[232 + i * 12, -92], [252 + i * 12, -70], [246 + i * 12, -62]], '#B5453E', 4.5);
    ctx.restore();
  }
  // 얼굴: 앞유리 쪽 눈 + 앞범퍼 미소
  if (f.show !== false) {
    const ex = 70, ey = -246, blink = f.blink || 0;
    if (o.driver) { /* 운전자가 보이면 눈 생략 */ } else if (f.eyes === 'happy' || blink > .85) {
      ctx.beginPath(); ctx.arc(ex, ey + 8, 18, Math.PI * 1.1, Math.PI * 1.9); fillStroke(ctx, null, C.ink, 7);
    } else {
      ctx.save(); ctx.translate(ex, ey); ctx.scale(1, 1 - blink);
      ellipse(ctx, 0, 0, 26, 30, C.white, C.ink, 6);
      circle(ctx, 9, 3, 13, C.ink, null); circle(ctx, 5, -3, 4.5, C.white, null);
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha *= .5; ellipse(ctx, 232, -128, 18, 10, C.coral, null); ctx.restore();
    if (f.mouth === 'open') {
      ctx.beginPath(); ctx.moveTo(234, -114); ctx.quadraticCurveTo(250, -80, 272, -108); ctx.closePath(); fillStroke(ctx, '#B5453E', C.ink, 5);
    } else {
      ctx.beginPath(); ctx.arc(254, -124, 18, Math.PI * .25, Math.PI * .8); fillStroke(ctx, null, C.ink, 6);
    }
  }
  ctx.restore();
  // 바퀴
  for (const wx of [-160, 168]) {
    ctx.beginPath(); ctx.arc(wx, -50 - bob, 70, Math.PI, 0); ctx.fillStyle = C.ink; ctx.fill();
    circle(ctx, wx, -52, 56, C.tire, C.ink, LW);
    circle(ctx, wx, -52, 32, C.gray, C.ink, 5);
    for (let i = 0; i < 5; i++) {
      const a = wa + i * Math.PI * 2 / 5;
      line(ctx, [[wx, -52], [wx + Math.cos(a) * 28, -52 + Math.sin(a) * 28]], C.inkSoft, 5);
    }
    circle(ctx, wx, -52, 9, C.white, C.ink, 4);
  }
}

/* ---------------- 소품 ---------------- */
function drawKey(ctx, x, y, s = 1, rot = 0, t = 0) {
  at(ctx, x, y, s, rot, () => {
    circle(ctx, 0, 0, 26, C.yellow, C.ink, 6); circle(ctx, 0, 0, 9, C.cream, C.ink, 5);
    rr(ctx, 18, -8, 72, 16, 6); fillStroke(ctx, C.yellow, C.ink, 6);
    rr(ctx, 60, 6, 10, 16, 3); fillStroke(ctx, C.yellow, C.ink, 5);
    rr(ctx, 76, 6, 10, 12, 3); fillStroke(ctx, C.yellow, C.ink, 5);
  });
}

function drawPhone(ctx, cx, cy, w, h, screenFn, o = {}) {
  ctx.save(); ctx.globalAlpha *= .15; rr(ctx, cx - w / 2 + 14, cy - h / 2 + 18, w, h, 52); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 52); fillStroke(ctx, o.body || C.coral, C.ink, 8);
  const sx = cx - w / 2 + 20, sy = cy - h / 2 + 20, sw = w - 40, sh = h - 40;
  rr(ctx, sx, sy, sw, sh, 36); fillStroke(ctx, o.screen || C.white, C.ink, 6);
  ctx.save(); rr(ctx, sx, sy, sw, sh, 36); ctx.clip();
  if (screenFn) screenFn(sx, sy, sw, sh);
  ctx.restore();
  pill(ctx, cx, sy + 22, 90, 20, C.ink, null);
}

function drawPin(ctx, x, y, s = 1, color = C.coral, inner = C.white) {
  at(ctx, x, y, s, 0, () => {
    ctx.save(); ctx.globalAlpha *= .18; ellipse(ctx, 0, 0, 26, 8, C.ink, null); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, -30, -48, -54, -48, -86);
    ctx.arc(0, -86, 48, Math.PI, 0);
    ctx.bezierCurveTo(48, -54, 20, -30, 0, 0); ctx.closePath();
    fillStroke(ctx, color, C.ink, 7);
    circle(ctx, 0, -88, 20, inner, C.ink, 5);
  });
}

function drawClock(ctx, x, y, r, t, speed = 1) {
  circle(ctx, x, y, r, C.white, C.ink, 8);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    line(ctx, [[x + Math.cos(a) * r * .78, y + Math.sin(a) * r * .78], [x + Math.cos(a) * r * .88, y + Math.sin(a) * r * .88]], C.ink, i % 3 ? 4 : 7);
  }
  const am = t * speed * Math.PI * 2 - Math.PI / 2, ah = am / 12 - Math.PI / 3;
  line(ctx, [[x, y], [x + Math.cos(ah) * r * .45, y + Math.sin(ah) * r * .45]], C.ink, 10);
  line(ctx, [[x, y], [x + Math.cos(am) * r * .7, y + Math.sin(am) * r * .7]], C.coral, 7);
  circle(ctx, x, y, 8, C.ink, null);
  // 자명종 벨
  ellipse(ctx, x - r * .7, y - r * .85, r * .28, r * .2, C.yellow, C.ink, 6, -.6);
  ellipse(ctx, x + r * .7, y - r * .85, r * .28, r * .2, C.yellow, C.ink, 6, .6);
}

function drawCard(ctx, x, y, w, h, time, title, col) {
  ctx.save(); ctx.globalAlpha *= .15; rr(ctx, x + 8, y + 10, w, h, 22); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
  rr(ctx, x, y, w, h, 22); fillStroke(ctx, C.white, C.ink, 6);
  ctx.save(); rr(ctx, x, y, w, h, 22); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(x, y, 30, h); ctx.restore();
  line(ctx, [[x + 30, y + 4], [x + 30, y + h - 4]], C.ink, 5);
  textAt(ctx, time, x + 50, y + h / 2, 34, C.inkSoft, FONT_SUB, 'left', '700');
  textAt(ctx, title, x + 162, y + h / 2 + 2, 42, C.ink, FONT_HEAD, 'left');
}

/* 아이콘 타일: 'office' | 'laptop' | 'home' */
function drawIconTile(ctx, kind, x, y, s, col) {
  at(ctx, x, y, s, 0, () => {
    rr(ctx, -90, -90, 180, 180, 46); fillStroke(ctx, col, C.ink, 8);
    if (kind === 'office') {
      rr(ctx, -40, -58, 80, 116, 8); fillStroke(ctx, C.white, C.ink, 6);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { rr(ctx, -26 + j * 30, -44 + i * 28, 20, 18, 3); fillStroke(ctx, C.sky, C.ink, 4); }
      rr(ctx, -12, 32, 24, 26, 3); fillStroke(ctx, C.coral, C.ink, 4);
    } else if (kind === 'laptop') {
      rr(ctx, -54, -46, 108, 70, 10); fillStroke(ctx, C.white, C.ink, 6);
      line(ctx, [[-34, 8], [-14, -12], [4, 0], [30, -26]], C.coral, 7);
      ctx.beginPath(); ctx.moveTo(-70, 26); ctx.lineTo(70, 26); ctx.lineTo(60, 44); ctx.lineTo(-60, 44); ctx.closePath(); fillStroke(ctx, C.gray, C.ink, 6);
    } else if (kind === 'home') {
      ctx.beginPath(); ctx.moveTo(-58, -4); ctx.lineTo(0, -58); ctx.lineTo(58, -4); ctx.closePath(); fillStroke(ctx, C.coral, C.ink, 6);
      rr(ctx, -44, -8, 88, 64, 6); fillStroke(ctx, C.white, C.ink, 6);
      rr(ctx, -12, 18, 24, 38, 4); fillStroke(ctx, C.yellow, C.ink, 5);
      // 빨래 바구니
      rr(ctx, 30, 22, 44, 32, 8); fillStroke(ctx, C.yellowL, C.ink, 5);
      circle(ctx, 42, 18, 9, C.sky, C.ink, 4); circle(ctx, 60, 16, 9, C.coralL, C.ink, 4);
    }
  });
}

function drawHouse(ctx, x, y, s = 1) {
  at(ctx, x, y, s, 0, () => {
    rr(ctx, -150, -230, 300, 230, 14); fillStroke(ctx, C.cream);
    ctx.beginPath(); ctx.moveTo(-185, -220); ctx.lineTo(0, -360); ctx.lineTo(185, -220); ctx.closePath(); fillStroke(ctx, C.coral);
    rr(ctx, 70, -350, 40, 80, 6); fillStroke(ctx, C.coralL);
    rr(ctx, -40, -130, 80, 130, 10); fillStroke(ctx, C.yellow);
    circle(ctx, 24, -64, 6, C.ink, null);
    rr(ctx, -128, -180, 66, 60, 8); fillStroke(ctx, C.sky); line(ctx, [[-95, -180], [-95, -120]], C.ink, 5);
    rr(ctx, 62, -180, 66, 60, 8); fillStroke(ctx, C.sky); line(ctx, [[95, -180], [95, -120]], C.ink, 5);
  });
}

function drawBuilding(ctx, x, y, w, h, col) {
  rr(ctx, x, y - h, w, h, 10); fillStroke(ctx, col, C.ink, 6);
  for (let yy = y - h + 24; yy < y - 50; yy += 54)
    for (let xx = x + 20; xx < x + w - 40; xx += 46) { rr(ctx, xx, yy, 26, 30, 5); fillStroke(ctx, C.cream, C.ink, 4); }
}

function drawTree(ctx, x, y, s = 1) {
  at(ctx, x, y, s, 0, () => {
    limb(ctx, [[0, 0], [0, -70]], '#C99A6E', 16);
    circle(ctx, 0, -110, 58, C.mint, C.ink, 6);
    circle(ctx, -22, -126, 12, C.mintL, null);
  });
}

/* 브랜드 로고 마크 (로고 미제공 → 텍스트+심볼로 구현) */
function drawLogoMark(ctx, x, y, s = 1, t = 0) {
  at(ctx, x, y, s, 0, () => {
    // 기어 링
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a = i * Math.PI / teeth + t * .5, r = i % 2 ? 62 : 74;
      ctx.lineTo(Math.cos(a - .14) * r, Math.sin(a - .14) * r); ctx.lineTo(Math.cos(a + .14) * r, Math.sin(a + .14) * r);
    }
    ctx.closePath(); fillStroke(ctx, C.teal, C.ink, 6);
    circle(ctx, 0, 0, 50, C.white, C.ink, 6);
    // 미니 자동차
    rr(ctx, -32, -10, 64, 26, 10); fillStroke(ctx, C.coral, C.ink, 5);
    ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-12, -26); ctx.lineTo(12, -26); ctx.lineTo(20, -10); ctx.closePath(); fillStroke(ctx, C.coral, C.ink, 5);
    circle(ctx, -18, 18, 8, C.ink, null); circle(ctx, 18, 18, 8, C.ink, null);
  });
}
