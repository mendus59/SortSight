// Draws one lesson frame (or the in-between of two frames) on the whiteboard
// canvas using the hand-drawn primitives in sketch.js.
import { BOARD_W, BOARD_H } from './lessons.js';
import { rng, hash, linePts, curvePts, ellipsePts, marker, roughRect, hatch, arrowHead, handText } from './sketch.js';

export const INK = {
  ink: '#1f2a44',
  focus: '#e0701f',
  done: '#23935a',
  pick: '#7a44c2',
  low: '#2a68d1',
  high: '#d23f3a',
  faded: '#b5bac6',
};

export const FONT = "'Kalam', 'Comic Sans MS', 'Chalkboard SE', cursive";

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ballR = (v) => 16 + v * 2.7;

export class Board {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frame = null;
    this.from = new Map(); // id -> {x, y} where each item started this transition
    this.shown = new Map(); // id -> {x, y} where each item is drawn right now
    this.start = 0;
    this.moveMs = 650;
    this.drawMs = 550;
    this.reduced = false;
    this.tick = 0;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.width * (BOARD_H / BOARD_W) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = w / BOARD_W;
  }

  show(frame, now, { instant = false } = {}) {
    this.from = new Map(this.shown);
    this.frame = frame;
    this.start = instant || this.reduced ? now - 1e6 : now;
    this.lastKey = null;
  }

  // True while something is still moving or being written.
  busy(now) {
    return now - this.start < this.moveMs * 0.55 + this.drawMs + 50;
  }

  draw(now) {
    const f = this.frame;
    if (!f) return;
    const elapsed = now - this.start;
    const tMove = this.reduced ? 1 : clamp01(elapsed / this.moveMs);
    const tDraw = this.reduced ? 1 : clamp01((elapsed - this.moveMs * 0.55) / this.drawMs);
    // Line "boil": the wobble re-rolls a few times a second, like hand-drawn animation.
    const tick = this.reduced ? 0 : Math.floor(now / 240);
    const key = `${tMove}|${tDraw}|${tick}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    const e = ease(tMove);
    const at = new Map();
    for (const it of f.items) {
      const from = this.from.get(it.id) || { x: it.x, y: it.y };
      const dx = it.x - from.x;
      const hop = Math.abs(dx) > 4 ? Math.sin(Math.PI * e) * Math.min(70, Math.abs(dx) * 0.35) : 0;
      const p = { x: from.x + dx * e, y: from.y + (it.y - from.y) * e - hop };
      at.set(it.id, p);
      this.shown.set(it.id, { x: p.x, y: p.y + hop });
    }
    const byId = new Map(f.items.map((it) => [it.id, it]));
    const geom = (id) => {
      const it = byId.get(id);
      const p = at.get(id);
      if (f.shape === 'ball') {
        const rr = ballR(it.value);
        return { x: p.x, y: p.y, top: p.y - rr, bottom: p.y + rr, r: rr, mid: p.y };
      }
      const h = it.value * f.unit;
      return { x: p.x, y: p.y, top: p.y - h, bottom: p.y + 42, mid: p.y - h / 2, w: f.barWidth };
    };
    const seed = (...k) => rng(hash(tick, ...k));

    // Tree branches go underneath the balls.
    for (const m of f.marks) {
      if (m.kind !== 'edge') continue;
      const a = geom(m.a);
      const b = geom(m.b);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      marker(ctx, (r) => linePts(a.x + ux * (a.r + 4), a.y + uy * (a.r + 4), b.x - ux * (b.r + 4), b.y - uy * (b.r + 4), r), seed('edge', m.a, m.b), { color: '#5d6782', width: 2.4 });
    }

    for (const it of f.items) this.drawItem(it, geom(it.id), seed('item', it.id));

    for (const [i, m] of f.marks.entries()) {
      if (m.kind === 'edge') continue;
      this.drawMark(m, geom, seed('mark', i, m.kind), tDraw);
    }

    if (f.heading) this.drawHeading(f.heading, seed('heading'), this.reduced ? 1 : clamp01(elapsed / 900));
  }

  drawItem(it, g, rnd) {
    const ctx = this.ctx;
    const color = INK[it.role] || INK.ink;
    ctx.save();
    if (this.frame.shape === 'ball') {
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r - 2, 0, Math.PI * 2);
      ctx.save();
      ctx.clip();
      hatch(ctx, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2, rnd, { color, alpha: it.role === 'faded' ? 0.25 : 0.32, gap: 10 });
      ctx.restore();
      marker(ctx, (r) => ellipsePts(g.x, g.y, g.r, g.r, r), rnd, { color, width: 3.2 });
      ctx.fillStyle = '#fdfdfb';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.min(17, g.r * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      handText(ctx, String(it.value), g.x, g.y + 1, rnd, { color, size: 28, weight: 700, font: FONT });
    } else {
      const x = g.x - g.w / 2;
      const h = g.y - g.top;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, g.top, g.w, h);
      ctx.clip();
      hatch(ctx, x, g.top, g.w, h, rnd, { color, alpha: it.role === 'faded' ? 0.28 : 0.45 });
      ctx.restore();
      roughRect(ctx, x, g.top, g.w, h, rnd, { color, width: 3.2 });
      // a little ground line under each block
      marker(ctx, (r) => linePts(g.x - g.w / 2 - 10, g.y + 3, g.x + g.w / 2 + 10, g.y + 3, r, 0.7), rnd, { color: '#8a91a3', width: 2 });
      handText(ctx, String(it.value), g.x, g.y + 26, rnd, { color, size: 30, weight: 700, font: FONT });
    }
    ctx.restore();
  }

  drawMark(m, geom, rnd, p) {
    const ctx = this.ctx;
    if (p <= 0) return;
    switch (m.kind) {
      case 'swap': {
        const a = geom(m.a);
        const b = geom(m.b);
        const color = INK.focus;
        if (this.frame.shape === 'ball') {
          // a two-headed arrow alongside the branch
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / len;
          const ny = (b.x - a.x) / len;
          const off = 26;
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const x1 = a.x + nx * off + ux * a.r;
          const y1 = a.y + ny * off + uy * a.r;
          const x2 = b.x + nx * off - ux * b.r;
          const y2 = b.y + ny * off - uy * b.r;
          const mx = (x1 + x2) / 2 + nx * 18;
          const my = (y1 + y2) / 2 + ny * 18;
          const pts = curvePts(x1, y1, mx, my, x2, y2, rnd);
          marker(ctx, () => pts, rnd, { color, width: 3, progress: p });
          if (p >= 1) {
            arrowHead(ctx, pts, rnd, { color, width: 3 });
            arrowHead(ctx, pts.slice().reverse(), rnd, { color, width: 3 });
          }
        } else {
          const lift = Math.max(40, Math.abs(b.x - a.x) * 0.35);
          const ya = a.top - 14;
          const yb = b.top - 14;
          const top = Math.min(ya, yb) - lift;
          const p1 = curvePts(a.x, ya, (a.x + b.x) / 2, top, b.x, yb, rnd);
          marker(ctx, () => p1, rnd, { color, width: 3, progress: p });
          if (p >= 1) arrowHead(ctx, p1, rnd, { color });
          const p2 = curvePts(b.x, yb - 4, (a.x + b.x) / 2, top - 26, a.x, ya - 4, rnd);
          marker(ctx, () => p2, rnd, { color, width: 3, progress: p });
          if (p >= 1) arrowHead(ctx, p2, rnd, { color });
          if (p >= 1) handText(ctx, 'swap!', (a.x + b.x) / 2, top - 34, rnd, { color, size: 26, weight: 700, font: FONT });
        }
        break;
      }
      case 'check': {
        const a = geom(m.a);
        const b = geom(m.b);
        const x = (a.x + b.x) / 2;
        const y = this.frame.shape === 'ball' ? (a.y + b.y) / 2 : Math.min(a.top, b.top) - 34;
        const color = INK.done;
        const pts = [...linePts(x - 14, y, x - 4, y + 12, rnd), ...linePts(x - 4, y + 12, x + 18, y - 16, rnd)];
        marker(ctx, () => pts, rnd, { color, width: 4, progress: p });
        break;
      }
      case 'label':
      case 'pointer': {
        const g = geom(m.id);
        const color = INK[m.role] || (m.kind === 'label' ? INK.pick : INK.focus);
        const tipY = g.top - 10;
        const tailY = tipY - 52;
        const pts = linePts(g.x + 8, tailY, g.x, tipY, rnd);
        marker(ctx, () => pts, rnd, { color, width: 3, progress: p });
        if (p >= 1) arrowHead(ctx, pts, rnd, { color, size: 11 });
        if (m.text && p > 0.3) {
          ctx.save();
          ctx.globalAlpha = clamp01((p - 0.3) / 0.5);
          handText(ctx, m.text, g.x + 10, tailY - 16, rnd, { color, size: 24, weight: 700, font: FONT });
          ctx.restore();
        }
        break;
      }
      case 'arrow': {
        const g = geom(m.id);
        const color = INK.focus;
        const y = g.mid;
        const x1 = g.x - 18 * m.dir;
        const x2 = g.x + (g.w / 2 + 34) * m.dir;
        const pts = linePts(x1, y, x2, y, rnd);
        marker(ctx, () => pts, rnd, { color, width: 3.5, progress: p });
        if (p >= 1) arrowHead(ctx, pts, rnd, { color });
        break;
      }
      case 'bracket': {
        const gs = m.ids.map(geom);
        const left = Math.min(...gs.map((g) => g.x - g.w / 2)) - 8;
        const right = Math.max(...gs.map((g) => g.x + g.w / 2)) + 8;
        const y = Math.max(...gs.map((g) => g.y)) + 50;
        const mid = (left + right) / 2;
        const color = INK.done;
        const pts = [
          ...linePts(left, y - 10, left + 6, y, rnd, 0.5),
          ...linePts(left + 6, y, mid - 8, y, rnd),
          ...linePts(mid - 8, y, mid, y + 9, rnd, 0.5),
          ...linePts(mid, y + 9, mid + 8, y, rnd, 0.5),
          ...linePts(mid + 8, y, right - 6, y, rnd),
          ...linePts(right - 6, y, right, y - 10, rnd, 0.5),
        ];
        marker(ctx, () => pts, rnd, { color, width: 3, progress: p });
        if (p > 0.5) handText(ctx, m.text, mid, y + 30, rnd, { color, size: 24, weight: 700, font: FONT });
        break;
      }
      case 'arc': {
        const a = geom(m.a);
        const b = geom(m.b);
        const y = Math.max(a.y, b.y) + 50;
        const color = INK.pick;
        const pts = curvePts(a.x, y, (a.x + b.x) / 2, y + 44, b.x, y, rnd);
        marker(ctx, () => pts, rnd, { color, width: 2.6, progress: p });
        if (m.text && p > 0.5) handText(ctx, m.text, (a.x + b.x) / 2, y + 40, rnd, { color, size: 22, weight: 700, font: FONT });
        break;
      }
      default:
        break;
    }
  }

  drawHeading(text, rnd, p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `700 46px ${FONT}`;
    const w = ctx.measureText(text).width;
    const x = 44;
    const y = 58;
    // write-on: reveal the title left to right
    ctx.beginPath();
    ctx.rect(x - 10, y - 50, (w + 30) * p, 100);
    ctx.clip();
    handText(ctx, text, x, y, rnd, { color: INK.ink, size: 46, weight: 700, align: 'left', font: FONT });
    marker(ctx, (r) => linePts(x - 4, y + 30, x + w + 8, y + 26, r), rnd, { color: INK.focus, width: 3.5 });
    ctx.restore();
  }
}
