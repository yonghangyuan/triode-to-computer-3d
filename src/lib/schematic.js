/**
 * 2D 电路图 / 原理图绘制
 * 用 Canvas 手绘，保证与 3D 场景状态严格同步（同一个 state → 同一画面）。
 */

const COL = {
  bg: 'rgba(4,9,16,0)',
  rail: '#ff7a6a',
  high: '#ffb454',
  highGlow: 'rgba(255,180,84,0.55)',
  low: '#4f86ff',
  lowGlow: 'rgba(79,134,255,0.5)',
  off: '#54687f',
  ground: '#5c7086',
  ink: '#c8d8e8',
  dim: '#6d8299',
  faint: 'rgba(120,170,255,0.22)',
  green: '#5ef0b0',
};

export class Painter {
  constructor(canvas, width = 380, height = 250) {
    this.canvas = canvas;
    this.w = width;
    this.h = height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.aspectRatio = `${width} / ${height}`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;
  }

  clear() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(8,18,32,0.55)');
    g.addColorStop(1, 'rgba(3,8,15,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 网格底纹
    ctx.strokeStyle = 'rgba(120,170,255,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 10; x < w; x += 20) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 10; y < h; y += 20) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
  }

  line(points, color, width = 1.6, { dash = null, glow = 0 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.stroke();
    ctx.restore();
  }

  curve(x1, y1, cx1, cy1, cx2, cy2, x2, y2, color, width = 1.6, { glow = 0, dash = null } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  }

  dot(x, y, color, r = 2.6) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  arrow(x1, y1, x2, y2, color, width = 1.6) {
    const { ctx } = this;
    this.line([[x1, y1], [x2, y2]], color, width);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const head = 6.5;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
    ctx.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  resistor(x, y1, y2, { color = COL.ink, label = 'Rp', value = '8 kΩ', side = 1 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = 6;
    const seg = (y2 - y1 - 12) / n;
    ctx.moveTo(x, y1);
    let y = y1 + 6;
    ctx.lineTo(x, y);
    const amp = 5;
    for (let i = 0; i < n; i += 1) {
      const yy = y + seg * (i + 0.5);
      ctx.lineTo(x + (i % 2 === 0 ? amp : -amp) * side, yy);
    }
    ctx.lineTo(x, y2 - 6);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.restore();
    if (label) this.label(label, x + 12 * side, (y1 + y2) / 2 - 5, { size: 9, color: COL.dim });
    if (value) this.label(value, x + 12 * side, (y1 + y2) / 2 + 7, { size: 8.5, color: COL.faint });
  }

  /** 三极管符号：屏极在上、阴极在下、栅极在左右一侧 */
  triode({ x, y, mirror = false, conducting = false, r = 24 }) {
    const { ctx } = this;
    const active = conducting;
    const ringCol = active ? COL.high : 'rgba(150,175,205,0.4)';
    // 电子流光晕
    if (active) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r * 1.9);
      g.addColorStop(0, 'rgba(255,180,84,0.20)');
      g.addColorStop(1, 'rgba(255,180,84,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // 圆壳
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 1.5;
    if (active) { ctx.shadowColor = COL.highGlow; ctx.shadowBlur = 14; }
    ctx.stroke();
    ctx.restore();

    const wire = active ? COL.high : COL.off;
    // 屏极（上）
    this.line([[x - 13, y - 11], [x + 13, y - 11]], wire, 2.2);
    this.line([[x, y - r], [x, y - 11]], wire, 1.6);
    // 栅极（虚线，接左侧或右侧）
    this.line([[x - 11, y], [x + 11, y]], active ? '#ffd9a0' : COL.dim, 1.4, { dash: [2.5, 3] });
    const gx = mirror ? x + r : x - r;
    this.line([[gx, y], [mirror ? x + 11 : x - 11, y]], active ? '#ffd9a0' : COL.dim, 1.4);
    // 阴极（下）
    this.line([[x - 12, y + 11], [x + 12, y + 11]], wire, 2.2);
    this.line([[x, y + 11], [x, y + r]], wire, 1.6);
    // 阴极发射箭头
    ctx.save();
    ctx.fillStyle = active ? COL.high : COL.off;
    ctx.globalAlpha = active ? 0.95 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x - 4, y + 8);
    ctx.lineTo(x + 4, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  terminal(x, y, { color = COL.high, label = '', sub = '', align = 'left' } = {}) {
    this.dot(x, y, color, 3.2);
    if (label) {
      const dx = align === 'left' ? 0 : 0;
      this.label(label, x + dx, y - 13, { size: 10, color: COL.ink, align });
    }
    if (sub) this.label(sub, x, y + 18, { size: 8.5, color: COL.dim, align: 'center' });
  }

  lamp(x, y, on) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    if (on) {
      const g = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 14);
      g.addColorStop(0, '#fff6e0');
      g.addColorStop(0.45, COL.high);
      g.addColorStop(1, 'rgba(255,140,40,0.05)');
      ctx.fillStyle = g;
      ctx.shadowColor = COL.highGlow;
      ctx.shadowBlur = 18;
    } else {
      ctx.fillStyle = 'rgba(20,34,52,0.9)';
    }
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255,220,160,0.9)' : 'rgba(120,170,255,0.3)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // 灯丝
    ctx.strokeStyle = on ? 'rgba(120,60,10,0.75)' : 'rgba(120,150,190,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 3);
    ctx.lineTo(x - 2, y - 3);
    ctx.lineTo(x + 1, y + 3);
    ctx.lineTo(x + 4, y - 3);
    ctx.stroke();
    ctx.restore();
    this.label(on ? '1' : '0', x + 16, y + 3, { size: 10, color: on ? COL.high : COL.low });
  }

  ground(x, y) {
    const c = COL.ground;
    this.line([[x, y - 12], [x, y]], c, 1.5);
    for (let i = 0; i < 3; i += 1) {
      const w = 13 - i * 4;
      this.line([[x - w / 2, y + i * 3.2], [x + w / 2, y + i * 3.2]], c, 1.5);
    }
  }

  label(text, x, y, { size = 9.5, color = COL.ink, align = 'left', mono = true, weight = 400 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.font = `${weight} ${size}px ${mono ? '"Cascadia Mono", Consolas, monospace' : '"PingFang SC", "Microsoft YaHei", sans-serif'}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

/** 双三极管并联构成的 NOR 门（真空管时代的"通用门"） */
export function renderNor(canvas, { a = 0, b = 0 } = {}) {
  const p = new Painter(canvas, 380, 260);
  p.clear();
  const t1 = a === 1;
  const t2 = b === 1;
  const out = !(t1 || t2);
  const outCol = out ? COL.high : COL.low;

  // 电源轨
  p.line([[28, 26], [352, 26]], COL.rail, 1.6, { glow: 8 });
  p.label('+150 V', 30, 16, { size: 9, color: COL.rail });
  // 屏极负载电阻
  p.resistor(200, 26, 74, { label: 'Rp', value: '8 kΩ' });
  p.dot(200, 26, COL.rail, 2.2);

  // 输出节点与负载线
  p.dot(200, 74, outCol, 3);
  p.line([[200, 74], [200, 92]], outCol, 1.8, { glow: out ? 10 : 4 });
  p.line([[200, 92], [350, 92]], outCol, 1.8, { glow: out ? 10 : 4 });
  p.lamp(362, 92, out === 1);
  p.label('OUT', 330, 80, { size: 9.5, color: COL.ink, align: 'right' });
  p.label(out ? '高电平 · 1' : '低电平 · 0', 250, 108, { size: 8.5, color: outCol, align: 'center' });

  // 屏极并联母线
  p.line([[200, 92], [200, 112]], outCol, 1.7);
  p.line([[120, 112], [280, 112]], outCol, 1.7);
  p.dot(200, 112, outCol, 2.4);
  p.line([[120, 112], [120, 152]], outCol, 1.7);
  p.line([[280, 112], [280, 152]], outCol, 1.7);

  // 两只三极管
  p.triode({ x: 120, y: 176, mirror: false, conducting: t1 });
  p.triode({ x: 280, y: 176, mirror: true, conducting: t2 });

  // 输入 A / B
  const aCol = a ? COL.high : COL.low;
  const bCol = b ? COL.high : COL.low;
  p.line([[28, 176], [96, 176]], aCol, 1.6, { glow: a ? 9 : 4 });
  p.line([[304, 176], [352, 176]], bCol, 1.6, { glow: b ? 9 : 4 });
  p.terminal(28, 176, { color: aCol, label: 'A', align: 'left' });
  p.terminal(352, 176, { color: bCol, label: 'B', align: 'right' });
  p.label(a ? '0 V → 导通' : '−6 V → 截止', 28, 198, { size: 8.5, color: aCol });
  p.label(b ? '0 V → 导通' : '−6 V → 截止', 352, 198, { size: 8.5, color: bCol, align: 'right' });

  // 阴极与地
  p.line([[120, 200], [120, 218], [280, 218], [280, 200]], COL.ground, 1.5);
  p.line([[200, 218], [200, 226]], COL.ground, 1.5);
  p.ground(200, 226);
  p.label('T1', 96, 148, { size: 9, color: COL.dim, align: 'right' });
  p.label('T2', 304, 148, { size: 9, color: COL.dim });

  // 说明
  p.label('两只三极管"并联"：任一栅极为 1 都会把输出拉低 → 或非门 NOR', 190, 250, {
    size: 8.5, color: COL.dim, align: 'center', mono: false,
  });
  return { out };
}

/** 双稳态：两个反相器首尾相接形成的"再生反馈"环路 */
export function renderLatch(canvas, { state = 1 } = {}) {
  const p = new Painter(canvas, 380, 230);
  p.clear();
  const nodeP = state === 1 ? 1 : 0;
  const nodeQ = 1 - nodeP;

  const boxTop = { x: 86, y: 58, w: 208, h: 40 };
  const boxBot = { x: 86, y: 150, w: 208, h: 40 };
  const box = (b, title, sub, hot) => {
    const { ctx } = p;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 9);
    ctx.fillStyle = hot ? 'rgba(255,180,84,0.10)' : 'rgba(16,32,52,0.7)';
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255,180,84,0.6)' : 'rgba(120,170,255,0.28)';
    ctx.lineWidth = 1.3;
    if (hot) { ctx.shadowColor = 'rgba(255,180,84,0.4)'; ctx.shadowBlur = 16; }
    ctx.stroke();
    ctx.restore();
    p.label(title, b.x + 14, b.y + 16, { size: 10, color: hot ? COL.high : COL.ink });
    p.label(sub, b.x + 14, b.y + 30, { size: 8.5, color: COL.dim });
    // 反相三角
    const cx = b.x + b.w - 34;
    const cy = b.y + b.h / 2;
    p.line([[cx - 12, cy - 9], [cx - 12, cy + 9], [cx + 10, cy], [cx - 12, cy - 9]], hot ? COL.high : COL.dim, 1.4);
    if (hot) p.dot(cx + 14, cy, COL.high, 2.4);
  };

  box(boxTop, '反相器 1（T1）', nodeP === 1 ? '输入低 → 输出高' : '输入高 → 输出低', nodeP === 1);
  box(boxBot, '反相器 2（T2）', nodeQ === 1 ? '输入低 → 输出高' : '输入高 → 输出低', nodeQ === 1);

  // 环路连线：上→右→下→左→上
  const rcol = 'rgba(120,170,255,0.35)';
  p.line([[294, 78], [330, 78], [330, 170], [294, 170]], rcol, 1.6);
  p.arrow(322, 124, 322, 136, rcol, 1.4);
  p.line([[86, 170], [50, 170], [50, 78], [86, 78]], rcol, 1.6);
  p.arrow(58, 124, 58, 112, rcol, 1.4);

  // 节点
  const pCol = nodeP ? COL.high : COL.low;
  const qCol = nodeQ ? COL.high : COL.low;
  p.dot(330, 78, pCol, 3.2);
  p.label(`节点 P = ${nodeP}`, 368, 58, { size: 9, color: pCol, align: 'right' });
  p.dot(330, 170, qCol, 3.2);
  p.label(`节点 Q = ${nodeQ}`, 368, 186, { size: 9, color: qCol, align: 'right' });
  p.dot(50, 78, qCol, 2.6);
  p.dot(50, 170, pCol, 2.6);

  // 再生箭头
  p.label('反相 → 再反相 → 自己保持自己的输入', 190, 124, {
    size: 9, color: COL.dim, align: 'center', mono: false,
  });
  p.label('两个状态都稳定，状态被"锁住" = 1 位记忆', 190, 212, {
    size: 8.5, color: COL.dim, align: 'center', mono: false,
  });
  return { nodeP, nodeQ };
}
