// Canvas bar chart. With more bars than device pixels, each pixel column
// draws the tallest bar it covers, so 10,000 items cost ~1 rect per pixel.

export class BarRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = [];
    this.max = 1;
    this.highlights = [];
    this.state = 'idle';
    this.resize();
    new ResizeObserver(() => { this.resize(); this.draw(); }).observe(canvas);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width * dpr));
    this.height = Math.max(1, Math.round(rect.height * dpr));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.dpr = dpr;
  }

  setValues(values) {
    this.values = values;
    let max = 0;
    for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
    let min = 0;
    for (let i = 0; i < values.length; i++) if (values[i] < min) min = values[i];
    this.max = max || 1;
    this.min = min;
  }

  colors() {
    const css = getComputedStyle(this.canvas);
    return {
      bar: css.getPropertyValue('--bar').trim() || '#6c8cff',
      read: css.getPropertyValue('--bar-read').trim() || '#ffc857',
      write: css.getPropertyValue('--bar-write').trim() || '#ff5d73',
      done: css.getPropertyValue('--bar-done').trim() || '#3ddc97',
      bad: css.getPropertyValue('--bar-bad').trim() || '#ff5d73',
    };
  }

  draw() {
    const { ctx, width: W, height: H, values } = this;
    const n = values.length;
    ctx.clearRect(0, 0, W, H);
    if (!n) return;
    const c = this._colors || (this._colors = this.colors());
    const range = this.max - this.min || 1;
    const topPad = 4 * this.dpr;
    const usable = H - topPad;
    const heightOf = (v) => Math.max(1, ((v - this.min) / range) * usable);

    ctx.fillStyle = this.state === 'done' ? c.done : this.state === 'unsorted' ? c.bad : c.bar;
    if (n <= W) {
      const bw = W / n;
      const gap = bw > 4 ? Math.min(2 * this.dpr, bw * 0.2) : 0;
      for (let i = 0; i < n; i++) {
        const h = heightOf(values[i]);
        ctx.fillRect(i * bw, H - h, bw - gap, h);
      }
    } else {
      // Each pixel column covers several items: draw solid up to the
      // smallest one and translucent up to the largest, so unsorted
      // regions read as a band and sorted ones as a crisp staircase.
      const per = n / W;
      const lo = new Float64Array(W);
      const hi = new Float64Array(W);
      for (let x = 0; x < W; x++) {
        const from = Math.floor(x * per);
        const to = Math.max(from + 1, Math.min(n, Math.floor((x + 1) * per)));
        let mn = Infinity;
        let mx = -Infinity;
        for (let i = from; i < to; i++) {
          const v = values[i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        lo[x] = heightOf(mn);
        hi[x] = heightOf(mx);
        ctx.fillRect(x, H - lo[x], 1, lo[x]);
      }
      ctx.globalAlpha = 0.35;
      for (let x = 0; x < W; x++) {
        if (hi[x] > lo[x]) ctx.fillRect(x, H - hi[x], 1, hi[x] - lo[x]);
      }
      ctx.globalAlpha = 1;
    }

    if (this.state === 'running' || this.state === 'paused') {
      const bw = W / n;
      const minW = Math.max(bw, 2 * this.dpr);
      const hl = this.highlights;
      for (let k = 0; k < hl.length; k += 2) {
        const i = hl[k];
        if (i < 0 || i >= n) continue;
        ctx.fillStyle = hl[k + 1] ? c.write : c.read;
        const h = heightOf(values[i]);
        const x = i * bw + bw / 2 - minW / 2;
        ctx.fillRect(x, H - h, minW, h);
      }
    }
  }
}
