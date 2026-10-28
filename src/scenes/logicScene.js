import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTriode } from '../lib/tube.js';
import { createElectronFlow } from '../lib/particles.js';
import { addStudioLighting, createChassis, createSocket, createResistor, createLamp, createPost, createWire, createVignettePlane } from '../lib/stage.js';
import { TUBE, cathodeState, plateCurrent, clamp } from '../lib/physics.js';
import { renderNor } from '../lib/schematic.js';

/**
   *
 */
export function createLogicScene(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 80);
  camera.position.set(0.15, 2.55, 4.15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.52, 0.0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 3.6;
  controls.maxDistance = 9;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.enabled = false;

  addStudioLighting(scene, { warmIntensity: 0.55 });
  scene.add(createVignettePlane());
  scene.add(createChassis({ width: 3.3, depth: 2.1, height: 0.16, y: -0.07 }));

  const state = { a: 1, b: 0, auto: false, autoTimer: 0, time: 0 };

  // ---------------------------------------------------------------- 3D 器件
  const sockets = [createSocket({ x: -0.75, y: 0.02, z: 0.05 }), createSocket({ x: 0.75, y: 0.02, z: 0.05 })];
  sockets.forEach((s) => scene.add(s));

  const tubes = sockets.map((s, i) => {
    const tube = createTriode({ scale: 0.62 });
    tube.group.position.set(i === 0 ? -0.75 : 0.75, 0.8, 0.05);
    scene.add(tube.group);
    const flow = createElectronFlow({
      count: 260,
      rc: 0.165,
      rg: 0.285,
      rp: 0.375,
      yMin: -0.3,
      yMax: 0.18,
      size: 0.03,
    });
    tube.group.add(flow.points);
    return { tube, flow };
  });

  const resistor = createResistor({ length: 0.9, radius: 0.06 });
  resistor.position.set(0, 0.2, -0.75);
  scene.add(resistor);

  const posts = {
    a: createPost({ color: 0xffb454 }),
    b: createPost({ color: 0x5fd8ff }),
    vplus: createPost({ color: 0xff6a5a }),
  };
  posts.a.position.set(-1.35, 0.02, 0.8);
  posts.b.position.set(1.35, 0.02, 0.8);
  posts.vplus.position.set(-1.35, 0.02, -0.8);
  Object.values(posts).forEach((p) => scene.add(p));


  const lampStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a99aa, metalness: 0.9, roughness: 0.3 }),
  );
  lampStand.position.set(0, 0.16, 0.84);
  scene.add(lampStand);
  const lamp = createLamp({ radius: 0.09 });
  lamp.position.set(0, 0.38, 0.84);
  scene.add(lamp);

  // ---------------------------------------------------------------- 导线
  const wireA = createWire([[-1.35, 0.14, 0.8], [-1.2, 0.42, 0.55], [-1.0, 0.3, 0.32], [-0.75, 0.16, 0.18]], { color: 0xffb454 });
  const wireB = createWire([[1.35, 0.14, 0.8], [1.2, 0.42, 0.55], [1.0, 0.3, 0.32], [0.75, 0.16, 0.18]], { color: 0x5fd8ff });
  const wireP1 = createWire([[-0.75, 0.14, 0.05], [-0.75, 0.42, -0.25], [-0.25, 0.42, -0.62], [0.57, 0.24, -0.75]], { color: 0xffb454 });
  const wireP2 = createWire([[0.75, 0.14, 0.05], [0.75, 0.42, -0.25], [0.55, 0.42, -0.55], [0.57, 0.24, -0.75]], { color: 0xffb454 });
  const wireV = createWire([[-1.35, 0.16, -0.8], [-1.0, 0.3, -0.8], [-0.57, 0.22, -0.75]], { color: 0xff6a5a, emissiveIntensity: 0.5 });
  const wireOut = createWire([[0.57, 0.22, -0.75], [0.95, 0.34, -0.25], [0.7, 0.34, 0.45], [0.1, 0.3, 0.84]], { color: 0xffb454 });
  [wireA, wireB, wireP1, wireP2, wireV, wireOut].forEach((w) => scene.add(w));

  // ---------------------------------------------------------------- 计算
  const VF = 6.3;
  const heatInfo = cathodeState(VF);
  const VG_ON = 0;
  const VG_OFF = -6.4;

  function solveOutput(vgA, vgB) {
    const ip = (vp, vg) => plateCurrent(vp, vg, VF);
    const f = (vp) => vp + (ip(vp, vgA) + ip(vp, vgB)) * TUBE.rp - TUBE.vbb;
    let lo = 0; let hi = TUBE.vbb;
    for (let i = 0; i < 44; i += 1) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    const vp = (lo + hi) / 2;
    return { vp, ipA: ip(vp, vgA), ipB: ip(vp, vgB) };
  }

  // ---------------------------------------------------------------- 面板
  const leftEl = document.createElement('div');
  leftEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">LAYER 02 · LOGIC</p>
        <h2 class="sec-title">逻辑门</h2>
      </div>
      <span class="sec-tag">NOR · 通用门</span>
    </div>
    <p class="lede">
      把两只三极管的屏极接到同一个负载电阻上：<strong>只要任一栅极为 1（0 V）</strong>，
      对应的管子就导通，把输出拉低。只有 A、B 都为 0 时输出才是 1——
      这是"<em>或非</em>"（NOR），一个能搭出所有逻辑的通用门。
    </p>

    <div class="switch-row" style="margin-top:16px">
      <button type="button" class="big-switch on" id="sw-a">
        <span class="lamp"></span><span class="name">输入 A</span><span class="state" id="sw-a-state">1 · 0 V</span>
      </button>
      <button type="button" class="big-switch" id="sw-b">
        <span class="lamp"></span><span class="name">输入 B</span><span class="state" id="sw-b-state">0 · −6 V</span>
      </button>
    </div>

    <div class="btn-row">
      <button type="button" class="btn primary" id="btn-auto">自动遍历真值表</button>
      <button type="button" class="btn" id="btn-reset">A=1 / B=0</button>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>物理上发生了什么</h3><span class="card-hint">PHYSICS</span></div>
      <p class="footnote">
        两只管子的阴极都接地、屏极都接到 OUT 节点，共用一个 8 kΩ 负载电阻 Rp。
        "并联"意味着电流可以走两条路：<b>T1 或 T2 任一导通，OUT 就被拉低</b>；
        两只都截止时，没有电流，OUT 被 Rp 拉高。
      </p>
      <p class="footnote">
        逻辑电平：栅极 <b>0 V = 1</b>，<b>−6 V = 0</b>；屏极 <b>高压 = 1</b>，<b>被拉低 = 0</b>。
        这正是真空管时代的做法——用负栅压"关断"，比用正电压"打开"更可靠。
      </p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>一种门，搭出全部逻辑</h3><span class="card-hint">UNIVERSAL</span></div>
      <p class="formula">
        NOT A = NOR(A, A) → <b id="f-not">?</b><br>
        AND = NOR(NOT A, NOT B) → <b id="f-and">?</b><br>
        OR = NOT(NOR(A, B)) → <b id="f-or">?</b>
      </p>
      <p class="footnote">德摩根律保证：只要有 NOR，再多的逻辑都能靠它拼出来。真实芯片里的"标准单元"逻辑，也是同一个道理。</p>
    </div>
  `;

  const rightEl = document.createElement('div');
  rightEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">TRUTH TABLE · LIVE</p>
        <h2 class="sec-title">真值表</h2>
      </div>
      <span class="state-badge amp" id="ro-out">OUT = 1</span>
    </div>

    <div class="readout" style="margin-top:14px">
      <div class="ro"><span class="ro-k">输入 A / B</span><span class="ro-v" id="ro-ab">1 / 0</span></div>
      <div class="ro"><span class="ro-k">屏极电压 V<sub>p</sub></span><span class="ro-v cyan" id="ro-vp">120<small>V</small></span></div>
      <div class="ro wide"><span class="ro-k">T1 / T2 状态</span><span class="ro-v" id="ro-tubes" style="font-size:13px">导通 / 截止</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>NOR 真值表</h3><span class="card-hint">点击左侧开关</span></div>
      <table class="truth-table">
        <thead><tr><th>A</th><th>B</th><th>A ∨ B</th><th>OUT = ¬(A∨B)</th></tr></thead>
        <tbody id="truth-body"></tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>电路图</h3><span class="card-hint">LIVE SCHEMATIC</span></div>
      <div class="canvas-wrap"><canvas id="nor-canvas"></canvas></div>
      <p class="footnote">两条黄色电流路径代表正在导通的管子；输出灯亮 = 逻辑 1。</p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>为什么从这里开始"抽象"</h3></div>
      <p class="lede">
        工程师不再关心电子的轨迹，只关心"1 和 0 的表格"：<br>
        <span class="mono hl-amber">NOR(A,B) = ¬(A ∨ B)</span><br><br>
        从这一刻起，电压、电流、栅极都退到幕后。<strong>逻辑</strong>成为新的思考单位——
        下一层，我们要让 1 和 0 自己"记住"自己。
      </p>
    </div>
  `;

  const $ = (s) => leftEl.querySelector(s);
  const r$ = (s) => rightEl.querySelector(s);

  const el = {
    swA: $('#sw-a'), swB: $('#sw-b'), swAState: $('#sw-a-state'), swBState: $('#sw-b-state'),
    btnAuto: $('#btn-auto'), btnReset: $('#btn-reset'),
    fNot: $('#f-not'), fAnd: $('#f-and'), fOr: $('#f-or'),
    roOut: r$('#ro-out'), roAb: r$('#ro-ab'), roVp: r$('#ro-vp'), roTubes: r$('#ro-tubes'),
    truthBody: r$('#truth-body'), canvas: r$('#nor-canvas'),
  };

  const TRUTH = [];
  for (const A of [0, 1]) for (const B of [0, 1]) TRUTH.push({ a: A, b: B, out: A || B ? 0 : 1, or: A || B ? 1 : 0 });
  el.truthBody.innerHTML = TRUTH.map((row, i) => `
    <tr data-row="${i}">
      <td class="${row.a ? 'v1' : 'v0'}">${row.a}</td>
      <td class="${row.b ? 'v1' : 'v0'}">${row.b}</td>
      <td>${row.or}</td>
      <td class="${row.out ? 'v1' : 'v0'}">${row.out}</td>
    </tr>`).join('');

  // 画布：DOM 插入后随时可画，尺寸由绘制函数自己按 dpr 设定
  function drawSchematic() {
    if (!el.canvas) return;
    renderNor(el.canvas, { a: state.a, b: state.b });
  }

  function nor(a, b) { return a || b ? 0 : 1; }

  function updateStatic() {
    const { a, b } = state;
    const out = nor(a, b);
    const vgA = a ? VG_ON : VG_OFF;
    const vgB = b ? VG_ON : VG_OFF;
    const { vp } = solveOutput(vgA, vgB);
    const t1 = a === 1;
    const t2 = b === 1;

    el.swA.classList.toggle('on', a === 1);
    el.swB.classList.toggle('on', b === 1);
    el.swAState.textContent = a ? '1 · 0 V' : '0 · −6 V';
    el.swBState.textContent = b ? '1 · 0 V' : '0 · −6 V';

    el.roOut.textContent = `OUT = ${out}`;
    el.roOut.className = `state-badge ${out ? 'amp' : 'cutoff'}`;
    el.roAb.textContent = `${a} / ${b}`;
    el.roVp.innerHTML = `${vp.toFixed(0)}<small>V</small>`;
    el.roTubes.innerHTML = `
      <span style="color:${t1 ? 'var(--amber)' : 'var(--blue)'}">T1 ${t1 ? '导通' : '截止'}</span>
      <span style="color:var(--ink-faint)"> / </span>
      <span style="color:${t2 ? 'var(--amber)' : 'var(--blue)'}">T2 ${t2 ? '导通' : '截止'}</span>`;

    const activeRow = TRUTH.findIndex((row) => row.a === a && row.b === b);
    el.truthBody.querySelectorAll('tr').forEach((tr) => tr.classList.toggle('active', Number(tr.dataset.row) === activeRow));

    el.fNot.textContent = `${nor(a, a)}`;
    el.fAnd.textContent = `${nor(nor(a, a), nor(b, b))}`;
    el.fOr.textContent = `${nor(nor(a, b), nor(a, b))}`;

    lamp.userData.set(out === 1, 1);

    // 导线颜色
    wireA.material.emissive.setHex(a ? 0xffb454 : 0x4f86ff);
    wireB.material.emissive.setHex(b ? 0xffb454 : 0x4f86ff);
    wireA.material.emissiveIntensity = a ? 0.9 : 0.35;
    wireB.material.emissiveIntensity = b ? 0.9 : 0.35;
    const outHigh = vp > TUBE.vbb * 0.7;
    [wireP1, wireP2, wireOut].forEach((w) => {
      w.material.emissive.setHex(outHigh ? 0xffb454 : 0x4f86ff);
      w.material.emissiveIntensity = outHigh ? 0.9 : 0.3;
    });


    tubes.forEach(({ flow }, i) => {
      const conducting = i === 0 ? t1 : t2;
      flow.setVisible(true);
      flow.update(0, { emission: 1, passRatio: conducting ? 0.6 : 0, vp: vp / TUBE.vbb });
    });


  }

  el.swA.addEventListener('click', () => { state.a = 1 - state.a; state.auto = false; el.btnAuto.classList.remove('on'); updateStatic(); });
  el.swB.addEventListener('click', () => { state.b = 1 - state.b; state.auto = false; el.btnAuto.classList.remove('on'); updateStatic(); });
  el.btnAuto.addEventListener('click', () => {
    state.auto = !state.auto;
    state.autoTimer = 0;
    el.btnAuto.classList.toggle('on', state.auto);
    el.btnAuto.textContent = state.auto ? '停止自动遍历' : '自动遍历真值表';
  });
  el.btnReset.addEventListener('click', () => {
    state.a = 1; state.b = 0; state.auto = false;
    el.btnAuto.classList.remove('on');
    el.btnAuto.textContent = '自动遍历真值表';
    updateStatic();
  });

  // ---------------------------------------------------------------- 标签
  const labels = [];
  const make = (text, anchor, offset) => {
    const lab = ctx.makeLabel(text, new THREE.Vector3(...anchor), { amber: true, offset });
    labels.push(lab);
    return lab;
  };
  make('输入 A', [-1.45, 0.32, 0.85], { x: -70, y: -10 });
  make('输入 B', [1.45, 0.32, 0.85], { x: 70, y: -10 });
  make('+150 V', [-1.45, 0.32, -0.85], { x: -60, y: -14 });
  make('T1', [-0.75, 1.5, 0.05], { x: 0, y: -12 });
  make('T2', [0.75, 1.5, 0.05], { x: 0, y: -12 });
  make('共用屏极电阻', [0, 0.5, -0.75], { x: 0, y: -24 });
  make('输出灯 OUT', [0, 0.7, 0.84], { x: 58, y: 0 });

  // ---------------------------------------------------------------- 动画
  let wasAuto = false;
  function update(dt, elapsed) {
    controls.update();
    state.time += dt;
    if (state.auto) {
      state.autoTimer -= dt;
      if (state.autoTimer <= 0) {
        state.autoTimer = 1.5;
        const idx = TRUTH.findIndex((row) => row.a === state.a && row.b === state.b);
        const next = TRUTH[(idx + 1) % 4];
        state.a = next.a; state.b = next.b;
        updateStatic();
      }
    }

    const vgA = state.a ? VG_ON : VG_OFF;
    const vgB = state.b ? VG_ON : VG_OFF;
    const { vp } = solveOutput(vgA, vgB);
    tubes.forEach(({ flow }, i) => {
      const conducting = i === 0 ? state.a === 1 : state.b === 1;
      flow.update(dt, { emission: 1, passRatio: conducting ? 0.6 : 0, vp: vp / TUBE.vbb });
    });
    // 灯的呼吸
    if (nor(state.a, state.b) === 1) {
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * 3.2);
      lamp.userData.set(true, pulse);
    }
  }



  return {
    id: 'logic',
    scene,
    camera,
    controls,
    labels,
    leftEl,
    rightEl,
    badge: 'L2 · TRIODE → NOR GATE',
    caption: '物理层：两只三极管并联，任一导通就把输出拉低。逻辑层：NOR(A,B) = ¬(A∨B)，而 NOR 可以搭出所有逻辑。',
    update,
    resize(w, h) {
      camera.aspect = w / h;

      camera.zoom = Math.min(1.25, Math.max(1, (w / h) / 0.95));
      camera.updateProjectionMatrix();
    },
    onActivate() {
      controls.enabled = true;

      updateStatic();
    },
    onDeactivate() {
      controls.enabled = false;
    },
    onPointerMove() {},
    onPointerClick() {},
  };
}
