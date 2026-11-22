#!/usr/bin/env node
/* =========================================================================
 * render.js — Playwright(Chromium)로 index.html 캔버스를 프레임 단위 렌더
 *
 *   node render/render.js                      # 전체 900프레임 → frames/ → MP4
 *   node render/render.js --stills 1,5.5,9.6   # 특정 시각 스틸 PNG (미리보기용)
 *   node render/render.js --cues-only          # 효과음 큐만 out/sfx_cues.json 으로
 *   옵션: --workers 4  --out out/techno_onestop_30s.mp4  --audio out/audio.wav
 * ========================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const WORKERS = +opt('workers', 4);
const OUT = path.resolve(ROOT, opt('out', 'out/techno_onestop_30s.mp4'));
const AUDIO = path.resolve(ROOT, opt('audio', 'out/audio.wav'));
const FRAMES_DIR = path.resolve(ROOT, opt('frames', 'out/frames'));
const STILLS = opt('stills', null);

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?render=1');
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
  return page;
}
async function grab(page, f) {
  const b64 = await page.evaluate(f => { renderFrame(f); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, f);
  return Buffer.from(b64, 'base64');
}

(async () => {
  const browser = await chromium.launch();
  if (STILLS) {
    const dir = path.resolve(ROOT, opt('dir', 'out/stills'));
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser);
    for (const s of STILLS.split(',')) {
      const f = Math.round(parseFloat(s) * 30);
      fs.writeFileSync(path.join(dir, `t${parseFloat(s).toFixed(2)}.png`), await grab(page, f));
    }
    await browser.close(); console.log('stills →', dir); return;
  }

  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const first = await openPage(browser);
  const total = await first.evaluate(() => window.TOTAL_FRAMES);
  const sfx = await first.evaluate(() => window.SFX);
  fs.writeFileSync(path.join(ROOT, 'out', 'sfx_cues.json'), JSON.stringify(sfx, null, 1));
  if (args.includes('--cues-only')) { await browser.close(); console.log('cues → out/sfx_cues.json'); return; }
  const pages = [first];
  for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser));

  const t0 = Date.now(); let done = 0;
  const chunk = Math.ceil(total / WORKERS);
  await Promise.all(pages.map(async (page, w) => {
    for (let f = w * chunk; f < Math.min(total, (w + 1) * chunk); f++) {
      fs.writeFileSync(path.join(FRAMES_DIR, `f${String(f).padStart(4, '0')}.png`), await grab(page, f));
      if (++done % 60 === 0) console.log(`  ${done}/${total} frames  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }));
  await browser.close();
  console.log(`frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  const ff = ['-y', '-framerate', '30', '-i', path.join(FRAMES_DIR, 'f%04d.png')];
  if (fs.existsSync(AUDIO)) ff.push('-i', AUDIO, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', '30', '-movflags', '+faststart', OUT);
  execFileSync('ffmpeg', ff, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('video →', OUT);
})();
