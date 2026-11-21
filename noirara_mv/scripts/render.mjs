// Usage:
//   node scripts/render.mjs stills <outDir> <sec,sec,...>
//   node scripts/render.mjs video  <out.mp4>
//   node scripts/render.mjs poster <out.jpg>
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const browserExecutable = process.env.REMOTION_BROWSER || null;
const [mode, out, list] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const chromiumOptions = { gl: "swangle" };

if (mode === "stills") {
  fs.mkdirSync(out, { recursive: true });
  const comp = await selectComposition({ serveUrl, id: "NoiraraMV", browserExecutable, chromiumOptions });
  for (const s of list.split(",").map(Number)) {
    const frame = Math.min(comp.durationInFrames - 1, Math.round(s * comp.fps));
    await renderStill({ composition: comp, serveUrl, frame, output: path.join(out, `f_${s.toFixed(2)}.jpg`), imageFormat: "jpeg", jpegQuality: 85, browserExecutable, chromiumOptions, scale: 0.5 });
    process.stdout.write(`${s} `);
  }
  console.log("done");
} else if (mode === "poster") {
  const comp = await selectComposition({ serveUrl, id: "Poster", browserExecutable, chromiumOptions });
  await renderStill({ composition: comp, serveUrl, frame: 0, output: out, imageFormat: "jpeg", jpegQuality: 94, browserExecutable, chromiumOptions });
  console.log("poster ->", out);
} else if (mode === "video") {
  const comp = await selectComposition({ serveUrl, id: "NoiraraMV", browserExecutable, chromiumOptions });
  let last = -1;
  await renderMedia({
    composition: comp,
    serveUrl,
    codec: "h264",
    crf: 17,
    pixelFormat: "yuv420p",
    muted: true, // the untouched original MP3 is muxed afterwards with ffmpeg (-c:a copy)
    imageFormat: "jpeg",
    jpegQuality: 95,
    concurrency: Number(process.env.CONCURRENCY || 4),
    outputLocation: out,
    browserExecutable,
    chromiumOptions,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) { last = p; console.log(`render ${Math.round(progress * 100)}%`); }
    },
  });
  console.log("video ->", out);
}
