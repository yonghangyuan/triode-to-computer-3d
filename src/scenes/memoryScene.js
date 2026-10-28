import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTriode } from '../lib/tube.js';
import { createElectronFlow } from '../lib/particles.js';
import { addStudioLighting, createChassis, createSocket, createLamp, createWire, createVignettePlane } from '../lib/stage.js';
import { cathodeState } from '../lib/physics.js';
import { renderLatch } from '../lib/schematic.js';

/**
   *
 */
export function createMemoryScene(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 80);
  camera.position.set(0.1, 2.4, 4.05);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.62, 0.0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 3.4;
  controls.maxDistance = 9.5;
  controls.minPolarAngle = Math.PI * 0.1;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.enabled = false;

  addStudioLighting(scene, { warmIntensity: 0.55 });
  scene.add(createVignettePlane());

  const state = { mode: 'ff', q: 1, count: 0, auto: false, hz: 1.2, timer: 0, pulse: 0, time: 0 };


  const ffGroup = new THREE.Group();
  scene.add(ffGroup);
  ffGroup.add(createChassis({ width: 3.0, depth: 1.9, height: 0.16, y: -0.07 }));

  const ffTubes = [-0.72, 0.72].map((x, i) => {
    ffGroup.add(createSocket({ x, y: 0.02, z: 0.05 }));
    const tube = createTriode({ scale: 0.68 });
    tube.group.position.set(x, 0.88, 0.05);
    ffGroup.add(tube.group);
    const flow = createElectronFlow({
      count: 240, rc: 0.165, rg: 0.285, rp: 0.375, yMin: -0.3, yMax: 0.18, size: 0.03,
    });
    tube.group.add(flow.points);
    return { tube, flow, x, idx: i };
  });

  const ffLampStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.26, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a99aa, metalness: 0.9, roughness: 0.3 }),
  );
  ffLampStand.position.set(0, 0.15, 0.78);
  ffGroup.add(ffLampStand);
  const ffLamp = createLamp({ radius: 0.1 });
  ffLamp.position.set(0, 0.38, 0.78);
  ffGroup.add(ffLamp);


  const fbA = createWire([[-0.72, 0.12, 0.26], [-0.45, 0.2, 0.72], [0.45, 0.2, 0.72], [0.72, 0.12, 0.26]], { color: 0xffb454, emissiveIntensity: 0.4 });
  const fbB = createWire([[-0.72, 0.12, -0.16], [-0.45, 0.34, -0.72], [0.45, 0.34, -0.72], [0.72, 0.12, -0.16]], { color: 0x4f86ff, emissiveIntensity: 0.4 });
  ffGroup.add(fbA, fbB);

  // ================================================================ 计数器组
  const counterGroup = new THREE.Group();
  counterGroup.visible = false;
  scene.add(counterGroup);
  counterGroup.add(createChassis({ width: 4.3, depth: 2.0, height: 0.16, y: -0.07 }));

  const BIT_X = [-1.55, -0.52, 0.52, 1.55];
  const bitTubes = BIT_X.map((x, i) => {
    counterGroup.add(createSocket({ x, y: 0.02, z: 0.0, radius: 0.26 }));
    const tube = createTriode({ scale: 0.55 });
    tube.group.position.set(x, 0.72, 0.0);
    counterGroup.add(tube.group);
    const flow = createElectronFlow({
      count: 170, rc: 0.165, rg: 0.285, rp: 0.375, yMin: -0.3, yMax: 0.18, size: 0.036,
    });
    tube.group.add(flow.points);

    // 位指示灯（管子前方的灯）
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a99aa, metalness: 0.9, roughness: 0.3 }),
    );
    stand.position.set(x, 0.1, 0.62);
    counterGroup.add(stand);
    const lamp = createLamp({ radius: 0.095 });
    lamp.position.set(x, 0.26, 0.62);
    counterGroup.add(lamp);
    return { tube, flow, lamp, x, idx: i };
  });

  // 时钟指示
  const clockPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.3, 14),
    new THREE.MeshStandardMaterial({ color: 0x8a99aa, metalness: 0.9, roughness: 0.3 }),
  );
  clockPost.position.set(0, 0.16, -0.82);
  counterGroup.add(clockPost);
  const clockLamp = createLamp({ radius: 0.12, color: 0x5fd8ff });
  clockLamp.position.set(0, 0.42, -0.82);
  counterGroup.add(clockLamp);
  clockLamp.userData.set(true, 0.4);

  // ================================================================ 面板
  const leftEl = document.createElement('div');
  leftEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">LAYER 03 · MEMORY</p>
        <h2 class="sec-title">触发器 · 寄存器</h2>
      </div>
      <span class="sec-tag">1 bit</span>
    </div>
    <p class="lede">
      让两个反相器首尾相接：输出接到对方的输入。<strong>电路会自己"咬住"自己</strong>——
      1 把对方压成 0，0 又反过来把 1 顶住。两个状态都稳定，这就是<em>记忆</em>。
    </p>

    <div class="seg" style="margin-top:16px" id="mode-seg">
      <button type="button" data-mode="ff" class="active">双稳态触发器</button>
      <button type="button" data-mode="counter">4 位计数器</button>
    </div>

    <div id="ff-box">
      <div class="switch-row" style="margin-top:16px">
        <button type="button" class="big-switch on" id="btn-set">
          <span class="lamp"></span><span class="name">写入 1（SET）</span><span class="state">SET</span>
        </button>
        <button type="button" class="big-switch" id="btn-reset">
          <span class="lamp"></span><span class="name">清零（RESET）</span><span class="state">RESET</span>
        </button>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>为什么能"记住"？</h3><span class="card-hint">FEEDBACK</span></div>
        <p class="footnote">
          假设 T1 导通、T2 截止：T1 把 T2 的栅极压得更负，T2 就更截止；
          而 T2 截止又让 T1 的屏极保持低电位，反过来维持 T1 导通。
          <b>两边的输出互相为对方提供输入</b>，状态就自洽地锁住了。
        </p>
        <p class="footnote">
          要改状态，必须从外部"推一把"：把 SET 脉冲加到 T2 栅极（或 RESET 加到 T1 栅极），
          打破平衡后电路会迅速滑向另一个稳定状态。
        </p>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>读与写</h3></div>
        <p class="footnote">
          <b>写</b>：给 SET / RESET 端子一个脉冲，强制电路进入指定状态。<br>
          <b>读</b>：测量输出端的高/低电平即可，不需要改变状态。<br>
          更完整的触发器还有"时钟"输入——只在时钟边沿才接受写入，这是同步计算机的基础。
        </p>
      </div>
    </div>

    <div id="counter-box" hidden>
      <div class="btn-row" style="margin-top:16px">
        <button type="button" class="btn primary" id="btn-clock">发一个时钟脉冲</button>
        <button type="button" class="btn" id="btn-auto-clock">自动时钟</button>
        <button type="button" class="btn" id="btn-clear">复位</button>
      </div>
      <div class="control">
        <div class="control-top"><span class="control-label">时钟频率</span><span class="control-value" id="hz-val">1.2 Hz</span></div>
        <input type="range" id="hz" min="0.4" max="4" step="0.1" value="1.2" aria-label="时钟频率">
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>4 位 = 一个半字节</h3></div>
        <p class="footnote">
          四个双稳态并排，就是一个 <b>4 位寄存器</b>：能存 0–15 共 16 个值。
          每来一个时钟脉冲，最低位翻转；它从 1 变 0 时，向高位"进位"。
          数到 1111（15）再加 1，就溢出回 0000。
        </p>
        <p class="footnote">
          这里把每位抽象成一只管子的导通/截止来观察；真实触发器由两只三极管交叉耦合构成（就是左边那个电路）。
        </p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>从记忆到计算</h3><span class="card-hint">NEXT</span></div>
      <p class="footnote">能存 1 位，就能存 4 位；能存 4 位，就能放一条指令的地址。<br>
      把"门"和"触发器"组合起来——加法器、寄存器、控制器——一台计算机的零件就齐了。</p>
    </div>
  `;

  const rightEl = document.createElement('div');
  rightEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">STATE · LIVE</p>
        <h2 class="sec-title" id="right-title">双稳态</h2>
      </div>
      <span class="state-badge amp" id="ro-state">Q = 1</span>
    </div>

    <div id="ff-readout">
      <div class="binary-big" id="ff-big">Q = 1</div>
      <p class="binary-sub" id="ff-sub">T1 导通 · T2 截止</p>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>状态机</h3><span class="card-hint">2 STATES</span></div>
        <div class="canvas-wrap"><canvas id="latch-canvas"></canvas></div>
        <p class="footnote">两个反相器环环相扣，形成两个稳定状态。SET / RESET 只是把电路从一个状态"推"到另一个。</p>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>它到底是什么</h3></div>
        <p class="lede">1 位 = 最小的记忆单位。<br>
        一个触发器 = 1 bit = 一个"是/否"。<br><br>
        内存、寄存器、缓存……<span class="hl-amber">所有存储，都是"保持住一个电平"这件事的放大版。</span></p>
      </div>
    </div>

    <div id="counter-readout" hidden>
      <div class="binary-big" id="cnt-binary">0000</div>
      <p class="binary-sub" id="cnt-sub">十进制 0 · 时钟 0 次</p>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>四个位</h3><span class="card-hint">Q3 … Q0</span></div>
        <div class="bits" id="cnt-bits"></div>
        <p class="footnote" style="margin-top:12px">灯亮 = 1，灯灭 = 0。数一数：从右往左，每位的"权重"是 1、2、4、8。</p>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title"><i></i>锁存与时钟</h3></div>
        <p class="lede">计数器每收一个时钟脉冲就 +1。<br>
        时钟是计算机的"心跳"：它让所有触发器<b>同时</b>翻到下一个状态，
        整个机器才能一步一步、可预测地向前走。</p>
      </div>
    </div>
  `;

  const $ = (s) => leftEl.querySelector(s);
  const r$ = (s) => rightEl.querySelector(s);

  const el = {
    modeSeg: $('#mode-seg'),
    ffBox: $('#ff-box'), counterBox: $('#counter-box'),
    btnSet: $('#btn-set'), btnReset: $('#btn-reset'),
    btnClock: $('#btn-clock'), btnAuto: $('#btn-auto-clock'), btnClear: $('#btn-clear'),
    hz: $('#hz'), hzVal: $('#hz-val'),
    rightTitle: r$('#right-title'), roState: r$('#ro-state'),
    ffReadout: r$('#ff-readout'), counterReadout: r$('#counter-readout'),
    ffBig: r$('#ff-big'), ffSub: r$('#ff-sub'), latchCanvas: r$('#latch-canvas'),
    cntBinary: r$('#cnt-binary'), cntSub: r$('#cnt-sub'), cntBits: r$('#cnt-bits'),
  };

  el.cntBits.innerHTML = [3, 2, 1, 0].map((i) => `
    <div class="bit"><div class="bit-lamp" data-bit="${i}">0</div><span class="bit-name">Q${i}</span></div>`).join('');

  // ================================================================ 更新 UI
  function updateFFUI() {
    const on = state.q === 1;
    el.roState.textContent = `Q = ${state.q}`;
    el.roState.className = `state-badge ${on ? 'amp' : 'cutoff'}`;
    el.ffBig.textContent = `Q = ${state.q}`;
    el.ffSub.textContent = on ? 'T1 导通 · T2 截止 —— 环路稳定在 1' : 'T1 截止 · T2 导通 —— 环路稳定在 0';
    el.btnSet.classList.toggle('on', on);
    el.btnReset.classList.toggle('on', !on);
    renderLatch(el.latchCanvas, { state: state.q });
  }

  function bitsOf(v) {
    return [3, 2, 1, 0].map((i) => (v >> i) & 1);
  }

  function updateCounterUI() {
    const bits = bitsOf(state.count);
    el.cntBinary.textContent = bits.join('');
    el.cntSub.textContent = `十进制 ${state.count} · 时钟 ${state.ticks || 0} 次`;
    el.cntBits.querySelectorAll('.bit-lamp').forEach((lamp, idx) => {
      const bit = 3 - idx;
      const v = (state.count >> bit) & 1;
      lamp.textContent = String(v);
      lamp.classList.toggle('on', v === 1);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    const ff = mode === 'ff';
    ffGroup.visible = ff;
    counterGroup.visible = !ff;
    el.ffBox.hidden = !ff;
    el.counterBox.hidden = ff;
    el.ffReadout.hidden = !ff;
    el.counterReadout.hidden = ff;
    el.rightTitle.textContent = ff ? '双稳态' : '4 位计数器';
    el.modeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    if (ff) {
      camera.position.set(0.1, 2.4, 4.05);
      controls.target.set(0, 0.62, 0.0);
      updateFFUI();
    } else {
      camera.position.set(0.1, 2.7, 6.0);
      controls.target.set(0, 0.5, 0.0);
      updateCounterUI();
    }
    controls.update();
    syncLabelVisibility();
  }

  el.modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn && btn.dataset.mode !== state.mode) setMode(btn.dataset.mode);
  });

  el.btnSet.addEventListener('click', () => { state.q = 1; state.pulse = 1; updateFFUI(); });
  el.btnReset.addEventListener('click', () => { state.q = 0; state.pulse = 1; updateFFUI(); });

  function tick() {
    state.count = (state.count + 1) & 0xf;
    state.ticks = (state.ticks || 0) + 1;
    state.pulse = 1;
    updateCounterUI();
  }
  el.btnClock.addEventListener('click', tick);
  el.btnClear.addEventListener('click', () => { state.count = 0; state.ticks = 0; state.auto = false; el.btnAuto.classList.remove('on'); updateCounterUI(); });
  el.btnAuto.addEventListener('click', () => {
    state.auto = !state.auto;
    el.btnAuto.classList.toggle('on', state.auto);
    el.btnAuto.textContent = state.auto ? '停止自动时钟' : '自动时钟';
    state.timer = 0;
  });
  el.hz.addEventListener('input', () => {
    state.hz = Number(el.hz.value);
    el.hzVal.textContent = `${state.hz.toFixed(1)} Hz`;
  });

  // ================================================================ 标签
  const labels = [];
  const make = (text, anchor, offset, group = ffGroup) => {
    const lab = ctx.makeLabel(text, new THREE.Vector3(...anchor), { amber: true, offset });
    labels.push(lab);
    return lab;
  };

  const ffLabels = [
    make('T1', [-0.72, 1.5, 0.05], { x: 0, y: -12 }),
    make('T2', [0.72, 1.5, 0.05], { x: 0, y: -12 }),
    make('交叉反馈 · 互相锁住', [0, 0.95, 0.72], { x: 0, y: -20 }),
    make('输出灯 Q', [0, 0.62, 0.78], { x: 74, y: 0 }),
  ];
  const counterLabels = [
    ...BIT_X.map((x, i) => make(`Q${3 - i}`, [x, 1.4, 0.0], { x: 0, y: -12 })),
    make('时钟', [0, 0.7, -0.82], { x: 0, y: -14 }),
  ];
  const ffLabelSet = labels.slice(0, ffLabels.length);
  const counterLabelSet = labels.slice(ffLabels.length);

  function syncLabelVisibility() {
    const ff = state.mode === 'ff';
    ffLabelSet.forEach((l) => { l.hidden = !ff; });
    counterLabelSet.forEach((l) => { l.hidden = ff; });
  }

  // ================================================================ 动画
  const heat = cathodeState(6.3).heat;

  function update(dt, elapsed) {
    controls.update();
    state.time += dt;
    if (state.mode === 'counter' && state.auto) {
      state.timer += dt;
      const period = 1 / state.hz;
      if (state.timer >= period) {
        state.timer -= period;
        tick();
      }
    }
    state.pulse = Math.max(0, state.pulse - dt * 2.2);

    if (state.mode === 'ff') {
      ffTubes.forEach(({ tube, flow }, i) => {
        const conducting = i === 0 ? state.q === 1 : state.q === 0;
        tube.setState({ heat, ipRatio: conducting ? 0.55 : 0.02, vg: conducting ? -2.5 : -7, cutaway: false });
        flow.update(dt, { emission: 1, passRatio: conducting ? 0.65 : 0, vp: 0.7 });
      });
      ffLamp.userData.set(state.q === 1, 1);
      const activeColor = state.q === 1 ? 0xffb454 : 0x4f86ff;
      fbA.material.emissive.setHex(activeColor);
      fbA.material.emissiveIntensity = 0.7 + state.pulse * 0.6;
    } else {
      const bits = bitsOf(state.count);
      bitTubes.forEach(({ tube, flow, lamp }, i) => {
        const bit = bits[3 - i];
        tube.setState({ heat, ipRatio: bit ? 0.55 : 0.02, vg: bit ? -2.5 : -7, cutaway: false });
        flow.update(dt, { emission: 1, passRatio: bit ? 0.65 : 0, vp: 0.7 });
        lamp.userData.set(bit === 1, 0.9);
      });
      clockLamp.userData.set(true, 0.25 + state.pulse * 1.1);
    }
  }

  // 初始
  updateFFUI();
  updateCounterUI();
  renderLatch(el.latchCanvas, { state: state.q });

  return {
    id: 'memory',
    scene,
    camera,
    controls,
    labels,
    leftEl,
    rightEl,
    badge: 'L3 · GATE 03 · MEMORY',
    caption: '两个反相器首尾相接，就把一个电平"锁"成了 1 位记忆。四个这样的单元并排，就是 4 位寄存器。',
    update,
    resize(w, h) {
      camera.aspect = w / h;

      camera.zoom = Math.min(1.2, Math.max(1, (w / h) / 0.95));
      camera.updateProjectionMatrix();
    },
    onActivate() {
      controls.enabled = true;
      syncLabelVisibility();
      if (state.mode === 'ff') { updateFFUI(); renderLatch(el.latchCanvas, { state: state.q }); }
      else updateCounterUI();
    },
    onDeactivate() { controls.enabled = false; },
    onPointerMove() {},
    onPointerClick() {},
  };
}
