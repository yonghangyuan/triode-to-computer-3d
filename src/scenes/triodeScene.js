import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTriode, PART_INFO } from '../lib/tube.js';
import { createElectronFlow } from '../lib/particles.js';
import { addStudioLighting, createPlatform, createVignettePlane } from '../lib/stage.js';
import { TUBE, cathodeState, operatingPoint, plateCurrentMa, clamp } from '../lib/physics.js';

const PART_ORDER = ['filament', 'cathode', 'grid', 'plate', 'glass', 'base'];

/**
   *
 */
export function createTriodeScene(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  camera.position.set(0.22, 0.55, 3.75);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.04, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 2.6;
  controls.maxDistance = 8.2;
  controls.minPolarAngle = Math.PI * 0.14;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.enabled = false;

  addStudioLighting(scene);
  scene.add(createVignettePlane());

  const platform = createPlatform({ y: -1.42, radius: 1.7, opacity: 0.2 });
  scene.add(platform);

  const tube = createTriode({ scale: 1 });
  tube.group.position.set(0, -0.12, 0);
  scene.add(tube.group);

  const electrons = createElectronFlow({
    count: 950,
    rc: 0.165,
    rg: 0.285,
    rp: 0.375,
    yMin: -0.3,
    yMax: 0.18,
    size: 0.018,
  });
  tube.group.add(electrons.points);

  const state = {
    vf: 6.3,
    vg: -3.0,
    vbb: 160,
    mode: 'amp',
    amp: 1.2,
    a: 1,
    autoSwitch: false,
    switchTimer: 1.2,
    showElectrons: true,
    showLabels: true,
    cutaway: false,
    hovered: null,
    time: 0,
  };

  // ------------------------------------------------------------------ 面板
  const leftEl = document.createElement('div');
  leftEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">LAYER 01 · 1906 · AUDION</p>
        <h2 class="sec-title">真空三极管</h2>
      </div>
      <span class="sec-tag">电子阀门</span>
    </div>
    <p class="lede">
      一只抽成真空的玻璃管里，灯丝把阴极"烤"出电子；<strong>栅极</strong>像闸门一样，
      用几伏的电压控制上百伏的电子流。<em>放大、开关、逻辑</em>，全都从这里开始。
    </p>

    <div class="seg" id="mode-seg" style="margin-top:16px">
      <button type="button" data-mode="amp" class="active">模拟放大</button>
      <button type="button" data-mode="switch">数字开关</button>
    </div>

    <div class="control">
      <div class="control-top"><span class="control-label">灯丝电压 <b>V<sub>f</sub></b></span><span class="control-value" id="vf-val">6.3 V</span></div>
      <input type="range" id="vf" min="0" max="7.5" step="0.1" value="6.3" aria-label="灯丝电压">
      <div class="range-scale"><span>0 V</span><span>额定 6.3 V</span><span>7.5 V</span></div>
    </div>

    <div class="control">
      <div class="control-top"><span class="control-label">栅极偏压 <b>V<sub>g</sub></b></span><span class="control-value" id="vg-val">−3.0 V</span></div>
      <input type="range" id="vg" min="-9" max="0" step="0.1" value="-3" aria-label="栅极偏压">
      <div class="range-scale"><span>−9 V 截止</span><span>−4.5 V</span><span>0 V</span></div>
    </div>

    <div class="control">
      <div class="control-top"><span class="control-label">屏极电源 <b>V<sub>bb</sub></b></span><span class="control-value" id="vbb-val">160 V</span></div>
      <input type="range" id="vbb" min="80" max="220" step="5" value="160" aria-label="屏极电源电压">
      <div class="range-scale"><span>80 V</span><span>160 V</span><span>220 V</span></div>
    </div>

    <div id="amp-box" class="control">
      <div class="control-top"><span class="control-label">输入信号幅度 <b>v<sub>in</sub></b></span><span class="control-value" id="amp-val">1.2 V</span></div>
      <input type="range" id="amp" min="0" max="2.5" step="0.1" value="1.2" aria-label="输入信号幅度">
      <div class="range-scale"><span>0</span><span>±1.2 V</span><span>±2.5 V</span></div>
    </div>

    <div id="switch-box" hidden>
      <div class="switch-row" style="margin-top:16px">
        <button type="button" class="big-switch on" id="sw-a">
          <span class="lamp"></span><span class="name">输入 A</span><span class="state" id="sw-a-state">1 · 0 V</span>
        </button>
        <button type="button" class="big-switch" id="sw-auto">
          <span class="lamp" style="background:radial-gradient(circle at 35% 30%, #cfe9ff, #4f86ff 60%, #1d3d8a)"></span>
          <span class="name">自动翻转</span><span class="state" id="sw-auto-state">关</span>
        </button>
      </div>
      <p class="footnote">把栅极从 0 V 拉到 −9 V：电子流被"闸住"，屏极电压升到接近电源电压——这就是数字电路里的 1 → 0。</p>
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="card-title"><i></i>显示选项</h3>
        <span class="card-hint">VIEW</span>
      </div>
      <label class="check-row"><span>电子流粒子</span>
        <span class="toggle"><input type="checkbox" id="opt-electrons" checked><i></i></span></label>
      <label class="check-row"><span>剖面视图（隐藏玻璃）</span>
        <span class="toggle"><input type="checkbox" id="opt-cutaway"><i></i></span></label>
      <label class="check-row"><span>元件标注</span>
        <span class="toggle"><input type="checkbox" id="opt-labels" checked><i></i></span></label>
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="card-title"><i></i>元件索引</h3>
        <span class="card-hint">点击查看</span>
      </div>
      <div class="btn-row" id="part-chips">
        ${PART_ORDER.map((k) => `<button type="button" class="btn tiny" data-part="${k}">${PART_INFO[k].name}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>历史坐标</h3></div>
      <p class="footnote">
        1906 年，德福雷斯特在二极管里加进一片"栅网"，做出 <b>Audion</b>——人类第一个电子放大器。
        40 年后，ENIAC 用 <b>17 468</b> 只真空管拼出第一台通用电子计算机，重 27 吨、耗电 150 kW，
        每秒约 5 000 次加法。<br><br>
        电子管的体积、发热和寿命，最终把它送进了博物馆；但它"用一个小信号控制大电流"的思想，
        被晶体管完整继承，一直留在这台电脑的芯片里。
      </p>
    </div>
  `;

  const rightEl = document.createElement('div');
  rightEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">LIVE READOUT</p>
        <h2 class="sec-title">实时仪表</h2>
      </div>
      <span class="state-badge amp" id="ro-state">放大区</span>
    </div>
    <div class="readout" style="margin-top:14px">
      <div class="ro"><span class="ro-k">屏极电流 I<sub>p</sub></span><span class="ro-v amber" id="ro-ip">0.0<small>mA</small></span></div>
      <div class="ro"><span class="ro-k">屏极电压 V<sub>p</sub></span><span class="ro-v" id="ro-vp">0<small>V</small></span></div>
      <div class="ro"><span class="ro-k">发射电流（饱和值）</span><span class="ro-v cyan" id="ro-em">30.0<small>mA</small></span></div>
      <div class="ro"><span class="ro-k">灯丝温度</span><span class="ro-v" id="ro-temp">2350<small>K</small></span></div>
      <div class="ro"><span class="ro-k">跨导 g<sub>m</sub></span><span class="ro-v" id="ro-gm">0.0<small>mA/V</small></span></div>
      <div class="ro"><span class="ro-k">电压增益 |A<sub>v</sub>|</span><span class="ro-v violet" id="ro-gain">0</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>这一刻发生了什么</h3></div>
      <p class="lede" id="insight">灯丝加热阴极，电子云在阴极周围聚集。</p>
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="card-title"><i></i>特性曲线 I<sub>p</sub> – V<sub>g</sub></h3>
        <span class="card-hint">屏极电压恒定</span>
      </div>
      <div class="canvas-wrap"><canvas id="curve-canvas"></canvas></div>
      <p class="footnote">曲线越陡，栅极的"控制力"越强。圆点就是当前工作点。</p>
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="card-title"><i></i>示波器</h3>
        <span class="card-hint" id="scope-hint">输入 Vg / 输出 Vp</span>
      </div>
      <div class="canvas-wrap"><canvas id="scope-canvas"></canvas></div>
      <p class="footnote">注意：输出波形与输入<strong>反相</strong>——输入升高，电子流增大，屏极电压被拉低。</p>
    </div>

    <div class="card" id="part-card">
      <div class="card-head"><h3 class="card-title"><i></i>元件说明</h3><span class="card-hint" id="part-en">CLICK A PART</span></div>
      <p class="lede" id="part-text">在 3D 模型上点击灯丝、阴极、栅极、屏极或外壳，查看它在这个"电子阀门"里扮演的角色。</p>
    </div>
  `;

  // ------------------------------------------------------------------ 绑定
  const $ = (sel, root = leftEl) => root.querySelector(sel);
  const r$ = (sel) => rightEl.querySelector(sel);

  const el = {
    vf: $('#vf'), vg: $('#vg'), vbb: $('#vbb'), amp: $('#amp'),
    vfVal: $('#vf-val'), vgVal: $('#vg-val'), vbbVal: $('#vbb-val'), ampVal: $('#amp-val'),
    modeSeg: $('#mode-seg'), ampBox: $('#amp-box'), switchBox: $('#switch-box'),
    swA: $('#sw-a'), swAState: $('#sw-a-state'), swAuto: $('#sw-auto'), swAutoState: $('#sw-auto-state'),
    optElectrons: $('#opt-electrons'), optCutaway: $('#opt-cutaway'), optLabels: $('#opt-labels'),
    chips: $('#part-chips'),
    roState: r$('#ro-state'), roIp: r$('#ro-ip'), roVp: r$('#ro-vp'), roEm: r$('#ro-em'),
    roTemp: r$('#ro-temp'), roGm: r$('#ro-gm'), roGain: r$('#ro-gain'),
    insight: r$('#insight'), scopeHint: r$('#scope-hint'),
    partEn: r$('#part-en'), partText: r$('#part-text'),
  };

  function syncSwitchUI() {
    el.swA.classList.toggle('on', state.a === 1);
    el.swAState.textContent = state.a === 1 ? '1 · 0 V' : '0 · −6 V';
    el.swAuto.classList.toggle('on', state.autoSwitch);
    el.swAutoState.textContent = state.autoSwitch ? '开' : '关';
  }

  el.modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    el.modeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    el.ampBox.hidden = state.mode !== 'amp';
    el.switchBox.hidden = state.mode !== 'switch';
    el.scopeHint.textContent = state.mode === 'amp' ? '输入 Vg / 输出 Vp' : '输入阶跃 / 输出翻转';
    syncSwitchUI();
  });

  el.vf.addEventListener('input', () => {
    state.vf = Number(el.vf.value);
    el.vfVal.textContent = `${state.vf.toFixed(1)} V`;
  });
  el.vg.addEventListener('input', () => {
    state.vg = Number(el.vg.value);
    el.vgVal.textContent = `${state.vg <= -0.05 ? '−' : ''}${Math.abs(state.vg).toFixed(1)} V`;
  });
  el.vbb.addEventListener('input', () => {
    state.vbb = Number(el.vbb.value);
    el.vbbVal.textContent = `${state.vbb} V`;
  });
  el.amp.addEventListener('input', () => {
    state.amp = Number(el.amp.value);
    el.ampVal.textContent = `±${state.amp.toFixed(1)} V`;
  });
  el.swA.addEventListener('click', () => { state.a = 1 - state.a; state.autoSwitch = false; syncSwitchUI(); });
  el.swAuto.addEventListener('click', () => { state.autoSwitch = !state.autoSwitch; state.switchTimer = 0.9; syncSwitchUI(); });
  el.optElectrons.addEventListener('change', () => { state.showElectrons = el.optElectrons.checked; electrons.setVisible(state.showElectrons); });
  el.optCutaway.addEventListener('change', () => { state.cutaway = el.optCutaway.checked; });
  el.optLabels.addEventListener('change', () => {
    state.showLabels = el.optLabels.checked;
    labels.forEach((l) => { l.hidden = !state.showLabels; });
  });
  el.chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-part]');
    if (btn) showPart(btn.dataset.part);
  });

  // ------------------------------------------------------------------ 标签
  const labels = [];
  const tubePos = tube.group.position;
  const make = (part, text, local, offset) => {
    const anchor = new THREE.Vector3(local[0] + tubePos.x, local[1] + tubePos.y, local[2] + tubePos.z);
    const lab = ctx.makeLabel(text, anchor, { amber: part !== 'glass', offset, part });
    labels.push(lab);
    return lab;
  };
  make('filament', '灯丝 · 加热发射', [0, -0.36, 0.2], { x: -96, y: 54 });
  make('cathode', '阴极 · 电子源', [-0.18, -0.12, 0.18], { x: -116, y: 4 });
  make('grid', '栅极 · 控制闸门', [0.31, 0.02, 0.2], { x: 122, y: -6 });
  make('plate', '屏极 · 收集电子', [0.42, 0.26, 0.06], { x: 128, y: -46 });
  make('glass', '玻璃外壳 · 真空', [0.52, 0.5, 0.0], { x: 108, y: -2 });
  make('base', '管座 · 引脚', [0.55, -1.14, 0.1], { x: 104, y: -22 });

  // ------------------------------------------------------------------ 画布
  function initCanvas(canvas, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.aspectRatio = `${w} / ${h}`;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    const c2d = canvas.getContext('2d');
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: c2d, w, h };
  }
  const curveCv = initCanvas(r$('#curve-canvas'), 344, 190);
  const scopeCv = initCanvas(r$('#scope-canvas'), 344, 170);

  function bgGrid(c, pad) {
    const { ctx: g, w, h } = c;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(9,20,35,0.85)');
    grad.addColorStop(1, 'rgba(4,9,16,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,170,255,0.09)';
    g.lineWidth = 1;
    g.beginPath();
    const step = 24;
    for (let x = pad.l; x <= w - pad.r + 0.5; x += step) { g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); }
    for (let y = h - pad.b + 0.5; y >= pad.t; y -= step) { g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); }
    g.stroke();
    g.strokeStyle = 'rgba(120,170,255,0.28)';
    g.beginPath();
    g.moveTo(pad.l, pad.t); g.lineTo(pad.l, h - pad.b); g.lineTo(w - pad.r, h - pad.b);
    g.stroke();
  }

  function drawCurves(op, vgInst) {
    const c = curveCv;
    const pad = { l: 34, r: 12, t: 14, b: 24 };
    bgGrid(c, pad);
    const { ctx: g, w, h } = c;
    const x = (vg) => pad.l + ((vg + 10) / 10) * (w - pad.l - pad.r);
    const y = (ip) => (h - pad.b) - (Math.min(ip, 32) / 32) * (h - pad.t - pad.b);

    // 曲线
    const vpList = [60, 90, 120, 150];
    vpList.forEach((vp, i) => {
      g.beginPath();
      for (let k = 0; k <= 60; k += 1) {
        const vg = -10 + (k / 60) * 10;
        const ip = plateCurrentMa(vp, vg, state.vf);
        const px = x(vg);
        const py = y(ip);
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokeStyle = `rgba(255,180,84,${0.22 + i * 0.2})`;
      g.lineWidth = 1.4;
      g.stroke();
    });
    g.font = '9px "Cascadia Mono", Consolas, monospace';
    g.fillStyle = 'rgba(255,180,84,0.55)';
    g.textAlign = 'right';
    g.fillText('Vp = 60…150 V', w - pad.r - 2, pad.t + 10);
    // 刻度
    g.fillStyle = 'rgba(140,170,200,0.6)';
    g.textAlign = 'center';
    for (const vg of [-10, -5, 0]) g.fillText(String(vg), x(vg), h - pad.b + 12);
    g.textAlign = 'right';
    for (const ip of [0, 10, 20, 30]) g.fillText(String(ip), pad.l - 6, y(ip) + 3);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(140,170,200,0.5)';
    g.fillText('Vg (V)', w - pad.r - 40, h - 6);
    g.fillText('Ip (mA)', pad.l + 2, pad.t + 2);


    const px = x(clamp(vgInst, -10, 0));
    // 工作点
    const py = y(op.ip * 1000);
    g.save();
    g.strokeStyle = 'rgba(95,216,255,0.28)';
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(pad.l, py); g.lineTo(px, py); g.lineTo(px, h - pad.b);
    g.stroke();
    g.restore();
    g.beginPath();
    g.arc(px, py, 4.2, 0, Math.PI * 2);
    g.fillStyle = '#ffd9a0';
    g.shadowColor = 'rgba(255,180,84,0.9)';
    g.shadowBlur = 14;
    g.fill();
    g.shadowBlur = 0;
  }

  const SCOPE_N = 220;
  const scope = { vg: new Float32Array(SCOPE_N), vp: new Float32Array(SCOPE_N), head: 0, count: 0 };
  function pushScope(vg, vp) {
    scope.vg[scope.head] = vg;
    scope.vp[scope.head] = vp;
    scope.head = (scope.head + 1) % SCOPE_N;
    scope.count = Math.min(SCOPE_N, scope.count + 1);
  }
  function drawScope() {
    const c = scopeCv;
    const pad = { l: 30, r: 12, t: 12, b: 16 };
    bgGrid(c, pad);
    const { ctx: g, w, h } = c;
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const upperTop = pad.t;
    const upperH = ih * 0.4;
    const lowerTop = pad.t + ih * 0.5;
    const lowerH = ih * 0.48;
    const xAt = (i) => pad.l + (i / Math.max(1, scope.count - 1)) * iw;


    let vgMin = Infinity; let vgMax = -Infinity;
    let vpMin = Infinity; let vpMax = -Infinity;
    for (let i = 0; i < scope.count; i += 1) {
      const idx = (scope.head - scope.count + i + SCOPE_N) % SCOPE_N;
      vgMin = Math.min(vgMin, scope.vg[idx]); vgMax = Math.max(vgMax, scope.vg[idx]);
      vpMin = Math.min(vpMin, scope.vp[idx]); vpMax = Math.max(vpMax, scope.vp[idx]);
    }
    if (!Number.isFinite(vgMin)) { vgMin = -6; vgMax = 0; vpMin = 0; vpMax = 160; }
    const padRange = (a, b, minSpan) => {
      let lo = a; let hi = b;
      if (hi - lo < minSpan) { const mid = (a + b) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
      const m = (hi - lo) * 0.18;
      return [lo - m, hi + m];
    };
    const [vLo, vHi] = padRange(vgMin, vgMax, 2.2);
    const [pLo, pHi] = padRange(vpMin, vpMax, 8);
    const yIn = (vg) => upperTop + upperH - ((vg - vLo) / (vHi - vLo)) * upperH;
    const yOut = (vp) => lowerTop + lowerH - ((vp - pLo) / (pHi - pLo)) * lowerH;

    // 上下两条基线
    g.strokeStyle = 'rgba(120,170,255,0.10)';
    g.beginPath();
    g.moveTo(pad.l, pad.t + ih * 0.46); g.lineTo(w - pad.r, pad.t + ih * 0.46);
    g.stroke();

    // 输入 trace（青）
    g.beginPath();
    for (let i = 0; i < scope.count; i += 1) {
      const idx = (scope.head - scope.count + i + SCOPE_N) % SCOPE_N;
      const px = xAt(i);
      const py = yIn(scope.vg[idx]);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokeStyle = 'rgba(95,216,255,0.85)';
    g.lineWidth = 1.4;
    g.shadowColor = 'rgba(95,216,255,0.5)';
    g.shadowBlur = 6;
    g.stroke();
    g.shadowBlur = 0;


    // 输出 trace（琥珀）
    g.beginPath();
    for (let i = 0; i < scope.count; i += 1) {
      const idx = (scope.head - scope.count + i + SCOPE_N) % SCOPE_N;
      const px = xAt(i);
      const py = yOut(scope.vp[idx]);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokeStyle = 'rgba(255,180,84,0.95)';
    g.lineWidth = 1.8;
    g.shadowColor = 'rgba(255,180,84,0.55)';
    g.shadowBlur = 8;
    g.stroke();
    g.shadowBlur = 0;

    g.font = '8.5px "Cascadia Mono", Consolas, monospace';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(95,216,255,0.85)';
    g.fillText(`Vg  ${vLo.toFixed(1)} … ${vHi.toFixed(1)} V`, pad.l + 4, upperTop + 9);
    g.fillStyle = 'rgba(255,180,84,0.9)';
    g.fillText(`Vp  ${pLo.toFixed(0)} … ${pHi.toFixed(0)} V`, pad.l + 4, lowerTop + 9);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(140,170,200,0.5)';
    g.fillText('t', w - pad.r - 2, h - 5);
  }

  // ------------------------------------------------------------------ 读数
  function setRo(node, value, unit) {
    node.innerHTML = `${value}${unit ? `<small>${unit}</small>` : ''}`;
  }
  const stateText = {
    cutoff: { label: '截止区 · 闸门关闭', cls: 'cutoff', tip: '栅极负到 −8 V 以下，阴极附近的电子被电场顶回去，屏极电流归零。数字逻辑里的"0"就藏在这个状态里。' },
    amp: { label: '放大区 · 受控', cls: 'amp', tip: '栅极上 ±1 V 的微小波动，在屏极上变成 ±10 V 以上的摆动。三极管把"小信号"翻译成"大信号"，这就是放大。' },
    sat: { label: '饱和区 · 全开', cls: 'sat', tip: '屏极电压被压得很低，电子几乎一出门就被屏极接住。再加栅压也挤不出更多电流——三极管此时就是一个"合上的开关"。' },
  };

  function updateReadouts(op, cs, vgInst, gainEstimate) {
    setRo(el.roIp, (op.ip * 1000).toFixed(1), 'mA');
    setRo(el.roVp, op.vp.toFixed(0), 'V');
    setRo(el.roEm, (cs.emission * 1000).toFixed(1), 'mA');
    setRo(el.roTemp, cs.temp.toFixed(0), 'K');
    setRo(el.roGm, (op.gm * 1000).toFixed(2), 'mA/V');
    el.roGain.textContent = Number.isFinite(gainEstimate) ? gainEstimate.toFixed(1) : '—';
    const st = stateText[op.state];
    el.roState.textContent = st.label;
    el.roState.className = `state-badge ${st.cls}`;

    let insight = st.tip;
    if (cs.emission < 0.0002) {
      insight = '灯丝还不够热：阴极几乎不发射电子。把 Vf 从 0 慢慢调到 6.3 V，看着电子云一点点多起来——发射电流对温度极其敏感（约 6 次方）。';
      el.roState.textContent = '未加热';
      el.roState.className = 'state-badge cutoff';
    } else if (state.mode === 'switch') {
      insight = state.a ? '输入 A = 1（栅极 0 V）：闸门打开，电子流通过，屏极被拉低 → 输出 0。' : '输入 A = 0（栅极 −9 V）：闸门关闭，屏极电流为零，输出升到高压 → 输出 1。注意：这是"反相"。';
    }
    el.insight.textContent = insight;
  }


  const labelsByPart = Object.fromEntries(labels.map((l) => [l.part, l]));

  function pick(ndc) {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(tube.pickables, false);
    if (!hits.length) return null;
    // 玻璃在最外层：优先让用户点到内部元件
    const inner = hits.find((h) => h.object.userData.part && h.object.userData.part !== 'glass');
    return (inner || hits[0]).object.userData.part;
  }

  function hover(part) {
    if (part === state.hovered) return;
    state.hovered = part;
    Object.entries(labelsByPart).forEach(([k, lab]) => {
      lab.el.classList.toggle('hot', k === part);
      lab.el.classList.toggle('dim', part != null && k !== part);
    });
    renderer.domElement.style.cursor = part ? 'pointer' : 'grab';
  }

  function showPart(part) {
    const info = PART_INFO[part];
    if (!info) return;
    el.partEn.textContent = info.en;
    el.partText.innerHTML = `<strong>${info.name}</strong><br>${info.text}`;
    el.partText.style.color = 'var(--ink-dim)';
    el.chips.querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.part === part));
  }

  // ------------------------------------------------------------------ 动画
  let curveTimer = 0;
  let scopeTimer = 0;
  let gainCache = NaN;

  function update(dt, elapsed) {
    controls.update();
    state.time += dt;

    if (state.mode === 'switch' && state.autoSwitch) {
      state.switchTimer -= dt;
      if (state.switchTimer <= 0) {
        state.a = 1 - state.a;
        state.switchTimer = 1.5;
        syncSwitchUI();
      }
    }

    let vgInst = state.vg;
    if (state.mode === 'amp') {
      vgInst = state.vg + state.amp * Math.sin(state.time * 2.1);
    } else {
      vgInst = state.a ? 0 : -9.2;
    }
    vgInst = clamp(vgInst, -10, 0);

    const op = operatingPoint(vgInst, state.vf, state.vbb, TUBE.rp);
    const cs = cathodeState(state.vf);
    const heat = cs.heat;

    tube.setState({
      heat,
      ipRatio: clamp(op.ip / TUBE.emissionMax, 0, 1),
      vg: vgInst,
      cutaway: state.cutaway,
    });

    const emissionNorm = clamp(cs.emission / TUBE.emissionMax, 0, 1);
    const passRatio = cs.emission > 1e-6 ? clamp((op.ip * 1000) / (cs.emission * 1000), 0, 1) : 0;
    electrons.update(dt, { emission: emissionNorm, passRatio, vp: op.vp / Math.max(1, state.vbb) });

    pushScope(vgInst, op.vp);


    if (state.mode === 'amp') {
      const lo = operatingPoint(clamp(state.vg - 1, -10, 0), state.vf, state.vbb, TUBE.rp);
      const hi = operatingPoint(clamp(state.vg + 1, -10, 0), state.vf, state.vbb, TUBE.rp);
      gainCache = Math.abs(hi.vp - lo.vp) / 2;
    } else {
      gainCache = NaN;
    }

    updateReadouts(op, cs, vgInst, gainCache);

    curveTimer += dt;
    scopeTimer += dt;
    if (curveTimer > 0.08) { curveTimer = 0; drawCurves(op, vgInst); }
    if (scopeTimer > 0.033) { scopeTimer = 0; drawScope(); }
  }

  // 初次绘制
  {
    const op = operatingPoint(state.vg, state.vf, state.vbb, TUBE.rp);
    drawCurves(op, state.vg);
    drawScope();
    showPart('plate');
    updateReadouts(op, cathodeState(state.vf), state.vg, 0);
  }

  return {
    id: 'triode',
    scene,
    camera,
    controls,
    labels,
    leftEl,
    rightEl,
    badge: 'L1 · ELECTRON → TRIODE',
    caption: '灯丝加热 → 阴极发射 → 栅极控制电子流 → 屏极收集。拖动旋转，点击元件查看说明。',
    update,
    resize(w, h) {
      camera.aspect = w / h;

      camera.zoom = Math.min(1.1, Math.max(1, (w / h) / 0.95));
      camera.updateProjectionMatrix();
    },
    onActivate() {
      controls.enabled = true;
      labels.forEach((l) => { l.hidden = !state.showLabels; });
    },
    onDeactivate() {
      controls.enabled = false;
      renderer.domElement.style.cursor = 'grab';
    },
    onPointerMove(ndc) { hover(pick(ndc)); },
    onPointerClick(ndc) {
      const part = pick(ndc);
      if (part) showPart(part);
    },
  };
}
