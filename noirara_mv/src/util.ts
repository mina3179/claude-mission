export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp(p), 3);
export const easeInCubic = (p: number) => Math.pow(clamp(p), 3);
export const easeInOutCubic = (p: number) => {
  p = clamp(p);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
export const easeInOutSine = (p: number) => -(Math.cos(Math.PI * clamp(p)) - 1) / 2;
export const easeOutExpo = (p: number) => (clamp(p) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p)));
// deterministic pseudo random
export const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
