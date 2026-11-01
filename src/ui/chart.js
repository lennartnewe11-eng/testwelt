// Zeitverlauf Greiferlast und Haltekraft (Canvas, letzte 20 s), mit Fadenkreuz-Tooltip.
export class LoadChart {
  constructor(canvas, tip, window = 20) {
    this.cv = canvas; this.tip = tip; this.win = window;
    this.reset();
    this.hover = null;
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); this.hover = e.clientX - r.left; this.draw(); });
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.tip.style.display = 'none'; this.draw(); });
  }
  reset() { this.t = []; this.a = []; this.b = []; }
  push(t, a, b) {
    this.t.push(t); this.a.push(a); this.b.push(b);
    while (this.t.length && this.t[0] < t - this.win) { this.t.shift(); this.a.shift(); this.b.shift(); }
  }
  draw() {
    const cv = this.cv, dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const ink3 = css.getPropertyValue('--ink-3').trim(), line = css.getPropertyValue('--line').trim();
    const s1 = css.getPropertyValue('--s1').trim(), s2 = css.getPropertyValue('--s2').trim();
    const L = 52, R = 10, T = 8, B = 20;
    const tNow = this.t.length ? this.t[this.t.length - 1] : 0;
    const t0 = Math.max(0, tNow - this.win), t1 = Math.max(this.win, tNow);
    let ymax = 0.1;
    for (let i = 0; i < this.t.length; i++) ymax = Math.max(ymax, this.a[i], this.b[i]);
    const step = niceStep(ymax / 4);
    ymax = Math.ceil(ymax / step) * step;
    const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    g.font = '11px "IBM Plex Mono", monospace';
    g.fillStyle = ink3; g.strokeStyle = line; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = 0; v <= ymax + 1e-9; v += step) {
      g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(W - R, Y(v) + 0.5); g.stroke();
      g.fillText(`${+v.toFixed(3)} N`.replace('.', ','), L - 4, Y(v));
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = Math.ceil(t0 / 5) * 5; t <= t1; t += 5) g.fillText(`${t} s`, X(t), H - B + 4);
    const series = (arr, color) => {
      if (this.t.length < 2) return;
      g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = 'round';
      g.beginPath();
      arr.forEach((v, i) => { const x = X(this.t[i]), y = Y(v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      const i = arr.length - 1;
      g.fillStyle = color; g.beginPath(); g.arc(X(this.t[i]), Y(arr[i]), 3, 0, 2 * Math.PI); g.fill();
    };
    series(this.b, s2);
    series(this.a, s1);
    if (this.hover !== null && this.t.length) {
      const th = t0 + ((this.hover - L) / (W - L - R)) * (t1 - t0);
      let k = 0, bd = Infinity;
      this.t.forEach((t, i) => { const d = Math.abs(t - th); if (d < bd) { bd = d; k = i; } });
      const x = X(this.t[k]);
      g.strokeStyle = ink3; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke(); g.setLineDash([]);
      this.tip.style.display = 'block';
      this.tip.innerHTML = `t ${this.t[k].toFixed(2)} s<br>Last ${this.a[k].toFixed(3)} N<br>Haltekraft ${this.b[k].toFixed(3)} N`;
      this.tip.style.left = `${Math.min(W - 150, Math.max(0, x + 8))}px`;
      this.tip.style.top = '6px';
    }
  }
}
function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(Math.max(x, 1e-6))), f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
