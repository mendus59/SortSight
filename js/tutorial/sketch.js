// Hand-drawn marker primitives for the whiteboard. Every shape is built from
// slightly wobbly point lists, so strokes can also be drawn "partially" while
// they are being written on. A seed makes the wobble repeatable per frame.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}

const jit = (rnd, amp) => (rnd() - 0.5) * 2 * amp;

// A wobbly line as a list of points (a gentle quadratic bow).
export function linePts(x1, y1, x2, y2, rnd, wobble = 1) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const amp = Math.min(2.2, len * 0.015) * wobble;
  const ax = x1 + jit(rnd, amp);
  const ay = y1 + jit(rnd, amp);
  const bx = x2 + jit(rnd, amp);
  const by = y2 + jit(rnd, amp);
  const bow = jit(rnd, Math.min(4, len * 0.025)) * wobble;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const cx = (ax + bx) / 2 + nx * bow;
  const cy = (ay + by) / 2 + ny * bow;
  const steps = Math.max(4, Math.min(24, Math.round(len / 12)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  return pts;
}

// A quadratic curve through a control point, with wobble.
export function curvePts(x1, y1, cx, cy, x2, y2, rnd, wobble = 1) {
  const amp = 1.6 * wobble;
  const pts = [];
  const ccx = cx + jit(rnd, 6 * wobble);
  const ccy = cy + jit(rnd, 6 * wobble);
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * x1 + 2 * u * t * ccx + t * t * x2 + jit(rnd, amp * 0.4),
      u * u * y1 + 2 * u * t * ccy + t * t * y2 + jit(rnd, amp * 0.4),
    ]);
  }
  return pts;
}

export function ellipsePts(cx, cy, rx, ry, rnd, wobble = 1) {
  const start = rnd() * Math.PI * 2;
  const sweep = Math.PI * 2 + 0.25 + rnd() * 0.25;
  const phase = rnd() * Math.PI * 2;
  const steps = 30;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    const k = 1 + Math.sin(a * 2 + phase) * 0.035 * wobble + (i / steps) * 0.04 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

// Stroke a point list. `progress` (0..1) draws only the first part, which
// gives the "being written right now" look.
export function stroke(ctx, pts, progress = 1) {
  if (progress <= 0 || pts.length < 2) return;
  const last = (pts.length - 1) * Math.min(1, progress);
  const whole = Math.floor(last);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= whole; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  const frac = last - whole;
  if (frac > 0 && whole + 1 < pts.length) {
    const [ax, ay] = pts[whole];
    const [bx, by] = pts[whole + 1];
    ctx.lineTo(ax + (bx - ax) * frac, ay + (by - ay) * frac);
  }
  ctx.stroke();
}

// Marker look: one firm stroke plus a faint second pass slightly off.
export function marker(ctx, makePts, rnd, { color, width = 3, progress = 1 } = {}) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  stroke(ctx, makePts(rnd), progress);
  ctx.globalAlpha *= 0.45;
  ctx.lineWidth = width * 0.6;
  stroke(ctx, makePts(rnd), progress);
  ctx.globalAlpha /= 0.45;
}

export function roughRect(ctx, x, y, w, h, rnd, opts) {
  const o = 3; // corners overshoot a little, like a quick marker sketch
  marker(ctx, (r) => linePts(x - o * r(), y, x + w + o * r(), y, r), rnd, opts);
  marker(ctx, (r) => linePts(x + w, y - o * r(), x + w, y + h + o * r(), r), rnd, opts);
  marker(ctx, (r) => linePts(x + w + o * r(), y + h, x - o * r(), y + h, r), rnd, opts);
  marker(ctx, (r) => linePts(x, y + h + o * r(), x, y - o * r(), r), rnd, opts);
}

// Diagonal hatching inside a clip path (set up by the caller).
export function hatch(ctx, x, y, w, h, rnd, { color, gap = 9, width = 1.6, alpha = 0.5 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let d = -h; d < w; d += gap) {
    const pts = linePts(x + d, y + h, x + d + h, y, rnd, 0.6);
    stroke(ctx, pts);
  }
  ctx.restore();
}

export function arrowHead(ctx, pts, rnd, { color, width = 3, size = 13 } = {}) {
  const n = pts.length;
  const [bx, by] = pts[n - 1];
  const [ax, ay] = pts[Math.max(0, n - 4)];
  const ang = Math.atan2(by - ay, bx - ax);
  for (const side of [-1, 1]) {
    const a = ang + Math.PI + side * (0.45 + jit(rnd, 0.08));
    const s = size * (0.9 + rnd() * 0.2);
    marker(ctx, (r) => linePts(bx, by, bx + Math.cos(a) * s, by + Math.sin(a) * s, r, 0.5), rnd, { color, width });
  }
}

export function handText(ctx, text, x, y, rnd, { color, size = 26, align = 'center', weight = 400, font } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(jit(rnd, 0.025));
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
