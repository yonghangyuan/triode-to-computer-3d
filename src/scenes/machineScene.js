import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createTriode } from '../lib/tube.js';
import { createElectronFlow } from '../lib/particles.js';
import { addStudioLighting, createVignettePlane } from '../lib/stage.js';
import { cathodeState } from '../lib/physics.js';
import { ToyCPU, PROGRAMS, buildMemory, ISA, disassemble } from '../lib/cpu.js';

/**
   *
   *
 */
export function createMachineScene(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 90);
  camera.position.set(0.3, 1.9, 7.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.42, 0.05);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.enabled = false;

  addStudioLighting(scene, { warmIntensity: 0.45 });
  const frontFill = new THREE.DirectionalLight(0xbfd4ff, 0.85);
  frontFill.position.set(0.4, 2.4, 7);
  scene.add(frontFill);
  scene.add(createVignettePlane());

  // ---------------------------------------------------------------- 机柜面板
  const PANEL_W = 5.2;
  const PANEL_H = 3.0;
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0a1420, metalness: 0.38, roughness: 0.66, envMapIntensity: 0.22,
  });
  const panel = new THREE.Mesh(new RoundedBoxGeometry(PANEL_W, PANEL_H, 0.16, 4, 0.06), panelMat);
  panel.position.set(0, 1.42, -0.22);
  scene.add(panel);

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(PANEL_W * 0.995, PANEL_H * 0.995, 0.17)),
    new THREE.LineBasicMaterial({ color: 0x4f86ff, transparent: true, opacity: 0.35 }),
  );
  frame.position.copy(panel.position);
  scene.add(frame);

  const frontZ = -0.13;


  function addInset(w, h, x, y) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, 0.015, 3, 0.025),
      new THREE.MeshStandardMaterial({
        color: 0x06101c, metalness: 0.3, roughness: 0.72, envMapIntensity: 0.18,
      }),
    );
    m.position.set(x, y, frontZ + 0.002);
    scene.add(m);
    return m;
  }
  addInset(5.0, 0.62, 0, 2.62);
  addInset(2.58, 1.34, -1.24, 1.15);
  addInset(2.05, 1.62, 1.32, 1.62);
  addInset(4.9, 0.5, -0.1, 0.27);

  // ---------------------------------------------------------------- 文字贴图
  function textPlane(text, { w = 1.0, h = 0.17, color = '#cfe0f5', size = 52, glow = 'rgba(95,216,255,0.35)', weight = 500 } = {}) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * h) / w);
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = glow;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    mesh.renderOrder = 5;
    return mesh;
  }

  function addCaption(text, x, y, w = 1.0, h = 0.16) {
    const p = textPlane(text, { w, h });
    p.position.set(x, y, frontZ + 0.012);
    scene.add(p);
    return p;
  }

  addCaption('程序计数器 PC', -2.02, 2.78, 1.1, 0.15);
  addCaption('指令寄存器 IR', -0.52, 2.78, 1.05, 0.15);
  addCaption('时钟 CLK', 1.0, 2.78, 0.62, 0.14);
  addCaption('累加器 ACC · 4 位', -1.24, 1.6, 1.35, 0.13);
  addCaption('内存 16 × 4 bit', 1.32, 2.34, 1.3, 0.13);
  addCaption('输出 OUT', 1.92, 0.58, 0.8, 0.14);

  // ---------------------------------------------------------------- 位指示灯
  const lampGeo = new THREE.SphereGeometry(0.04, 16, 12);
  function bitLamp(x, y, color = 0xffb454) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x16202d, emissive: color, emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.3,
    });
    const mesh = new THREE.Mesh(lampGeo, mat);
    mesh.position.set(x, y, frontZ + 0.03);
    scene.add(mesh);
    return {
      mesh,
      set(v) {
        mat.emissiveIntensity = v ? 2.0 : 0.04;
        mat.color.setHex(v ? 0xffd8a0 : 0x16202d);
      },
    };
  }
  function lampRow(xs, y) {
    return xs.map((x) => bitLamp(x, y));
  }

  const PC_X = [-2.36, -2.14, -1.92, -1.7];
  const IR_X = [-1.32, -1.12, -0.92, -0.72, -0.52, -0.32, -0.12, 0.08];
  const OUT_X = [1.72, 1.94, 2.16, 2.38];
  const pcLamps = lampRow(PC_X, 2.5);
  const irLamps = lampRow(IR_X, 2.5);
  const outLamps = lampRow(OUT_X, 0.72);
  const clkLamp = bitLamp(1.0, 2.5, 0x5fd8ff);

  addCaption('位权', -2.36, 2.66, 0.4, 0.1);
  const bitWeights = [
    ['8', -2.36], ['4', -2.14], ['2', -1.92], ['1', -1.7],
  ];
  bitWeights.forEach(([t, x]) => {
    const p = textPlane(t, { w: 0.16, h: 0.1, color: '#6d8299', size: 56, glow: 'rgba(0,0,0,0)' });
    p.position.set(x, 2.31, frontZ + 0.012);
    scene.add(p);
  });

  // ---------------------------------------------------------------- 累加器：4 只三极管
  const shelf = new THREE.Mesh(
    new RoundedBoxGeometry(2.35, 0.09, 0.95, 3, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x1a2636, metalness: 0.8, roughness: 0.4 }),
  );
  shelf.position.set(-1.22, 0.55, 0.28);
  scene.add(shelf);

  const ACC_X = [-2.06, -1.51, -0.96, -0.41];
  const heat = cathodeState(6.3).heat;
  const accTubes = ACC_X.map((x) => {
    const tube = createTriode({ scale: 0.4 });
    tube.group.position.set(x, 1.02, 0.28);
    scene.add(tube.group);
    const flow = createElectronFlow({
      count: 130, rc: 0.165, rg: 0.285, rp: 0.375, yMin: -0.3, yMax: 0.18, size: 0.05,
    });
    tube.group.add(flow.points);
    return { tube, flow };
  });
  const accWeights = [8, 4, 2, 1];
  accWeights.forEach((w, i) => {
    const p = textPlane(String(w), { w: 0.18, h: 0.12, color: '#6d8299', size: 56, glow: 'rgba(0,0,0,0)' });
    p.position.set(ACC_X[i], 1.72, frontZ + 0.4);
    scene.add(p);
  });

  // ---------------------------------------------------------------- 内存 4×4
  const MEM_X = [0.72, 1.12, 1.52, 1.92];
  const MEM_Y = [2.08, 1.78, 1.48, 1.18];
  const memCells = [];
  function memCellCanvas() {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 116;
    return c;
  }
  function drawMemCell(cell) {
    const { canvas: c, addr, value } = cell;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#081320';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(120,170,255,0.18)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
    g.font = '400 24px "Cascadia Mono", Consolas, monospace';
    g.fillStyle = '#5f748f';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(addr.toString(16).toUpperCase(), 8, 7);
    g.font = '600 50px "Cascadia Mono", Consolas, monospace';
    g.fillStyle = value === 0 ? '#8ba0b8' : '#ffcf8a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(value.toString(16).toUpperCase(), c.width / 2, c.height / 2 + 9);
    cell.tex.needsUpdate = true;
  }
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const addr = (3 - row) * 4 + col;
      const x = MEM_X[col];
      const y = MEM_Y[row];
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.25, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x0a1728, metalness: 0.4, roughness: 0.5, emissive: 0x2f6bff, emissiveIntensity: 0 }),
      );
      plate.position.set(x, y, frontZ + 0.01);
      scene.add(plate);
      const canvas = memCellCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.33, 0.24),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }),
      );
      face.position.set(x, y, frontZ + 0.026);
      scene.add(face);
      const cell = { addr, value: 0, canvas, tex, plate, face };
      drawMemCell(cell);
      memCells.push(cell);
    }
  }

  // ---------------------------------------------------------------- 总线
  const busDefs = [
    { name: 'addr', color: 0x5fd8ff, y: 0.14 },
    { name: 'data', color: 0xffb454, y: 0.28 },
    { name: 'ctrl', color: 0xa78bfa, y: 0.42 },
  ];
  const buses = {};
  busDefs.forEach(({ name, color, y }) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d1725, emissive: color, emissiveIntensity: 0.12, metalness: 0.6, roughness: 0.35,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.022, 0.03), mat);
    mesh.position.set(0, y, frontZ + 0.02);
    scene.add(mesh);
    buses[name] = mat;
  });
  const busNames = [['地址总线', 0.14], ['数据总线', 0.28], ['控制总线', 0.42]];
  busNames.forEach(([t, y], i) => {
    const p = textPlane(t, {
      w: 0.62, h: 0.1, color: ['#7fe4ff', '#ffcf8a', '#c4b2ff'][i], size: 44, glow: 'rgba(0,0,0,0)',
    });
    p.position.set(-2.48, y + 0.075, frontZ + 0.012);
    scene.add(p);
  });

  // ---------------------------------------------------------------- CPU
  const cpu = new ToyCPU();
  let programKey = 'add';
  let program = PROGRAMS[programKey];
  let mem = buildMemory(program);
  cpu.load(mem);

  const state = {
    running: false,
    hz: 5,
    timer: 0,
    pulse: 0,
    logs: [],
    programKey,
    stepCount: 0,
  };

  // ---------------------------------------------------------------- 面板
  const leftEl = document.createElement('div');
  leftEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">LAYER 04 · STORED PROGRAM</p>
        <h2 class="sec-title">存储程序计算机</h2>
      </div>
      <span class="sec-tag">4 bit</span>
    </div>
    <p class="lede">
      现在，把前面所有东西装进一台机器：<strong>三极管</strong>组成累加器，<strong>触发器</strong>组成寄存器和内存，
      <strong>门电路</strong>组成控制器。指令和数据一起放在内存里——这就是<em>存储程序</em>。
    </p>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>选择程序</h3><span class="card-hint">ROM</span></div>
      <div class="btn-row" id="program-btns" style="margin-top:0">
        <button type="button" class="btn primary" data-prog="add">${PROGRAMS.add.name}</button>
        <button type="button" class="btn" data-prog="loop">${PROGRAMS.loop.name}</button>
      </div>
      <p class="footnote" id="program-note">${PROGRAMS.add.note}</p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>控制台</h3><span class="card-hint">CONTROL</span></div>
      <div class="btn-row" style="margin-top:0">
        <button type="button" class="btn primary" id="btn-run">运行</button>
        <button type="button" class="btn" id="btn-micro">微步 ▸</button>
        <button type="button" class="btn" id="btn-instr">整条指令 ▸▸</button>
        <button type="button" class="btn" id="btn-reset">复位</button>
      </div>
      <div class="control">
        <div class="control-top"><span class="control-label">时钟速度</span><span class="control-value" id="hz-val">5.0 微步/秒</span></div>
        <input type="range" id="hz" min="1" max="20" step="1" value="5" aria-label="时钟速度">
      </div>
      <p class="footnote">"微步"= 一个节拍做一个动作；"整条指令"一次走完取指→译码→执行。</p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>指令集</h3><span class="card-hint">8 bit / 16 地址</span></div>
      <table class="truth-table" style="font-size:10.5px">
        <thead><tr><th>操作码</th><th>助记符</th><th>含义</th></tr></thead>
        <tbody>
          ${ISA.map((i) => `<tr><td>${i.code}</td><td class="v1">${i.name}</td><td style="font-family:var(--sans);color:var(--ink-faint)">${i.cn}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="footnote">指令 = 高 4 位操作码 + 低 4 位地址，8 个二进制位，恰好一个字节。</p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>存储程序思想</h3><span class="card-hint">VON NEUMANN</span></div>
      <p class="footnote">
        程序和数据放在同一块内存里，用同样的方式存取。机器不再"被接线决定做什么"，
        而是<b>读取内存里的指令</b>再执行——换一个程序，机器就换一种行为。
        这就是现代计算机的起点。
      </p>
    </div>
  `;

  const rightEl = document.createElement('div');
  rightEl.innerHTML = `
    <div class="sec-head">
      <div>
        <p class="eyebrow">EXECUTION · LIVE</p>
        <h2 class="sec-title">执行面板</h2>
      </div>
      <span class="state-badge cutoff" id="ro-state">已暂停</span>
    </div>

    <div class="pipeline" style="margin-top:14px" id="pipeline">
      <div class="stage-chip" data-stage="0"><span class="en">FETCH ①</span><span class="cn">取指·地址</span></div>
      <div class="stage-chip" data-stage="1"><span class="en">FETCH ②</span><span class="cn">取指·数据</span></div>
      <div class="stage-chip" data-stage="2"><span class="en">DECODE</span><span class="cn">译码</span></div>
      <div class="stage-chip" data-stage="3"><span class="en">EXECUTE</span><span class="cn">执行</span></div>
    </div>

    <div class="readout" style="margin-top:12px">
      <div class="ro"><span class="ro-k">PC 程序计数器</span><span class="ro-v amber" id="ro-pc">0</span></div>
      <div class="ro"><span class="ro-k">IR 指令寄存器</span><span class="ro-v" id="ro-ir">00<small>H</small></span></div>
      <div class="ro"><span class="ro-k">ACC 累加器</span><span class="ro-v cyan" id="ro-acc">0</span></div>
      <div class="ro"><span class="ro-k">OUT 输出</span><span class="ro-v green" id="ro-out">—</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>程序清单</h3><span class="card-hint" id="prog-title">3 + 5</span></div>
      <div class="program" id="program-list"></div>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>内存 16 × 4 bit</h3><span class="card-hint">点击数据单元可改值</span></div>
      <div class="mem-grid" id="mem-grid"></div>
      <p class="footnote">高亮的单元 = 当前"读"或"写"的地址；虚线框 = 下一条指令的地址（PC）。</p>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>执行日志</h3><span class="card-hint">MICRO-OPS</span></div>
      <ul class="log" id="log"></ul>
    </div>

    <div class="card">
      <div class="card-head"><h3 class="card-title"><i></i>输出记录</h3><span class="card-hint">OUT</span></div>
      <p class="lede" id="out-values">还没有输出。</p>
    </div>
  `;

  const $ = (s) => leftEl.querySelector(s);
  const r$ = (s) => rightEl.querySelector(s);

  const el = {
    programBtns: $('#program-btns'), programNote: $('#program-note'),
    btnRun: $('#btn-run'), btnMicro: $('#btn-micro'), btnInstr: $('#btn-instr'), btnReset: $('#btn-reset'),
    hz: $('#hz'), hzVal: $('#hz-val'),
    roState: r$('#ro-state'), pipeline: r$('#pipeline'),
    roPc: r$('#ro-pc'), roIr: r$('#ro-ir'), roAcc: r$('#ro-acc'), roOut: r$('#ro-out'),
    programList: r$('#program-list'), progTitle: r$('#prog-title'),
    memGrid: r$('#mem-grid'), log: r$('#log'), outValues: r$('#out-values'),
  };

  // ---------------------------------------------------------------- 日志
  function pushLog(entry) {
    state.logs.push(entry);
    if (state.logs.length > 40) state.logs.shift();
    el.log.innerHTML = state.logs.map((e, i) => `
      <li class="${i === state.logs.length - 1 ? 'new' : ''}">
        <span class="t">${String(e.t).padStart(3, '0')}</span>
        <span class="tag ${e.tag}">${e.label}</span>
        <span class="msg">${e.text}</span>
      </li>`).join('');
    el.log.scrollTop = el.log.scrollHeight;
  }

  // ---------------------------------------------------------------- 程序清单
  function renderProgramList() {
    const pc = cpu.pc;
    el.progTitle.textContent = program.name;
    el.programList.innerHTML = program.code.map(([asm, addr]) => {
      const active = addr === pc;
      const byte = (cpu.memory[addr] || 0).toString(16).toUpperCase().padStart(2, '0');
      return `<div class="prog-row ${active ? 'active' : ''}" title="${disassemble(cpu.memory[addr] || 0)}">
        <span class="hex">${addr.toString(16).toUpperCase()}</span>
        <span class="asm">${asm}</span>
        <span style="color:var(--ink-faint);font-size:9.5px">${byte}H</span>
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- 内存网格
  function renderMemGrid() {
    el.memGrid.innerHTML = '';
    for (let addr = 0; addr < 16; addr += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mem-cell';
      const value = cpu.memory[addr];
      const isData = addr >= 8;
      cell.classList.add(isData ? 'data' : 'rom');
      if (addr === cpu.lastRead) cell.classList.add('reading');
      if (addr === cpu.lastWrite) cell.classList.add('writing');
      if (addr === cpu.pc) cell.classList.add('pc');
      cell.innerHTML = `<span class="addr">${addr.toString(16).toUpperCase()}</span><span class="val">${value.toString(16).toUpperCase()}</span><span class="hint">${value.toString(2).padStart(4, '0')}</span>`;
      if (isData) {
        cell.title = `点击把 M[${addr}] 加 1（当前 ${value}）`;
        cell.addEventListener('click', () => {
          const v = (cpu.memory[addr] + 1) & 0xf;
          cpu.memory[addr] = v;
          mem[addr] = v;
          cpu.reset();
          state.running = false;
          state.timer = 0;
          el.btnRun.textContent = '运行';
          pushLog({ t: ++state.stepCount, tag: 'sys', label: 'DATA', text: `把 M[${addr}] 改为 ${v}，机器复位，等待运行。` });
          renderAll();
        });
      }
      el.memGrid.appendChild(cell);
    }
  }

  // ---------------------------------------------------------------- 3D 同步
  function syncScene() {
    const accBits = [3, 2, 1, 0].map((i) => (cpu.acc >> i) & 1);
    accTubes.forEach(({ tube, flow }, i) => {
      const bit = accBits[i];
      tube.setState({ heat, ipRatio: bit ? 0.55 : 0.02, vg: bit ? -2.5 : -7, cutaway: false });
    });

    const pcBits = [3, 2, 1, 0].map((i) => (cpu.pc >> i) & 1);
    pcLamps.forEach((lamp, i) => lamp.set(pcBits[i] === 1));
    const irBits = [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (cpu.ir >> i) & 1);
    irLamps.forEach((lamp, i) => lamp.set(irBits[i] === 1));
    const outBits = [3, 2, 1, 0].map((i) => (cpu.out >> i) & 1);
    outLamps.forEach((lamp, i) => lamp.set(outBits[i] === 1));

    // 内存内容
    memCells.forEach((cell) => {
      const v = cpu.memory[cell.addr];
      if (v !== cell.value) {
        cell.value = v;
        drawMemCell(cell);
      }
      const reading = cell.addr === cpu.lastRead;
      const writing = cell.addr === cpu.lastWrite;
      const atPc = cell.addr === cpu.pc;
      cell.plate.material.emissive.setHex(writing ? 0xffb454 : reading ? 0x5fd8ff : atPc ? 0x2f6bff : 0x2f6bff);
      cell.plate.material.emissiveIntensity = writing ? 0.9 : reading ? 0.7 : atPc ? 0.22 : 0;
    });
  }

  // ---------------------------------------------------------------- DOM 同步
  function renderAll() {
    const halted = cpu.halted;
    el.roPc.textContent = String(cpu.pc);
    el.roIr.innerHTML = `${cpu.ir.toString(16).toUpperCase().padStart(2, '0')}<small>H</small>`;
    el.roAcc.textContent = `${cpu.acc}`;
    el.roOut.textContent = cpu.outputs.length ? `${cpu.out}` : '—';
    el.roState.textContent = halted ? '已停机 · HLT' : state.running ? '运行中' : '已暂停';
    el.roState.className = `state-badge ${halted ? 'cutoff' : state.running ? 'amp' : 'sat'}`;

    const stage = halted ? -1 : cpu.phaseIndex;
    el.pipeline.querySelectorAll('.stage-chip').forEach((chip) => {
      chip.classList.toggle('active', Number(chip.dataset.stage) === stage);
    });

    renderProgramList();
    renderMemGrid();
    syncScene();
    el.outValues.textContent = cpu.outputs.length ? cpu.outputs.join(' → ') : '还没有输出。';
    el.btnRun.textContent = state.running ? '暂停' : '运行';
    el.btnRun.classList.toggle('on', state.running);
  }

  // ---------------------------------------------------------------- 操作
  function doMicro() {
    if (cpu.halted) {
      pushLog({ t: ++state.stepCount, tag: 'sys', label: 'HALT', text: '时钟已停，按"复位"重新开始。' });
      return;
    }
    const entry = cpu.step();
    const labels = { fetch: '取指', decode: '译码', exec: '执行', sys: '系统' };
    pushLog({ t: ++state.stepCount, tag: entry.tag, label: labels[entry.tag] || '步骤', text: entry.text });
    if (cpu.halted) {
      state.running = false;
      state.timer = 0;
    }
    renderAll();
  }

  function doInstruction() {
    if (cpu.halted) return;
    let guard = 0;

    do {
      doMicro();
      guard += 1;
    } while (!cpu.halted && cpu.phase !== 'fetch-addr' && guard < 12);
  }

  function loadProgram(key) {
    programKey = key;
    state.programKey = key;
    program = PROGRAMS[key];
    mem = buildMemory(program);
    cpu.load(mem);
    state.running = false;
    state.timer = 0;
    state.stepCount = 0;
    state.logs = [];
    el.log.innerHTML = '';
    el.programNote.textContent = program.note;
    el.programBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.prog === key));
    pushLog({ t: 0, tag: 'sys', label: 'LOAD', text: `载入程序「${program.name}」，内存已初始化，PC = 0。` });
    renderAll();
  }

  el.programBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-prog]');
    if (btn) loadProgram(btn.dataset.prog);
  });

  el.btnRun.addEventListener('click', () => {
    if (cpu.halted) { renderAll(); return; }
    state.running = !state.running;
    state.timer = 0;
    renderAll();
  });
  el.btnMicro.addEventListener('click', () => {
    state.running = false;
    doMicro();
  });
  el.btnInstr.addEventListener('click', () => {
    state.running = false;
    doInstruction();
  });
  el.btnReset.addEventListener('click', () => {
    cpu.reset();
    state.running = false;
    state.timer = 0;
    state.stepCount = 0;
    state.logs = [];
    el.log.innerHTML = '';
    pushLog({ t: 0, tag: 'sys', label: 'RESET', text: 'CPU 复位：PC=0，寄存器清零，内存保留当前内容。' });
    renderAll();
  });
  el.hz.addEventListener('input', () => {
    state.hz = Number(el.hz.value);
    el.hzVal.textContent = `${state.hz.toFixed(1)} 微步/秒`;
  });

  // ---------------------------------------------------------------- 标签
  const labels = [];


  // ---------------------------------------------------------------- 动画
  function update(dt, elapsed) {
    controls.update();
    state.pulse = Math.max(0, state.pulse - dt * 3);

    if (state.running && !cpu.halted) {
      state.timer += dt;
      const interval = 1 / state.hz;
      let guard = 0;
      while (state.timer >= interval && guard < 6) {
        state.timer -= interval;
        doMicro();
        guard += 1;
      }
    }

    // 累加器电子流
    const accBits = [3, 2, 1, 0].map((i) => (cpu.acc >> i) & 1);
    accTubes.forEach(({ flow }, i) => {
      flow.update(dt, { emission: 1, passRatio: accBits[i] ? 0.6 : 0, vp: 0.6 });
    });


    // 时钟灯：运行时呼吸
    const beat = state.running ? 0.6 + 0.5 * Math.sin(elapsed * Math.PI * 2 * Math.max(0.8, state.hz / 4)) : 0.35;
    clkLamp.set(state.running ? 1 : 0.4);
    clkLamp.mesh.material.emissiveIntensity = state.running ? 1.4 + beat : 0.18;

    // 总线脉冲
    const phase = cpu.halted ? 'halt' : cpu.phase;
    const addrOn = phase === 'fetch-addr' || (phase === 'execute' && cpu.bus.addr != null);
    const dataOn = phase === 'fetch-data' || (phase === 'execute' && cpu.bus.data != null);
    const ctrlOn = !cpu.halted;
    const glow = 0.18 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 5));
    if (buses.addr) buses.addr.emissiveIntensity = addrOn ? 1.1 * glow : 0.1;
    if (buses.data) buses.data.emissiveIntensity = dataOn ? 1.1 * glow : 0.1;
    if (buses.ctrl) buses.ctrl.emissiveIntensity = ctrlOn ? (phase === 'decode' ? 1.3 : 0.5) * glow : 0.08;

    // 内存高亮呼吸
    if (cpu.lastRead >= 0) {
      const cell = memCells.find((c) => c.addr === cpu.lastRead);
      if (cell) cell.plate.material.emissiveIntensity = 0.55 + 0.35 * Math.sin(elapsed * 8);
    }
  }

  // 初始
  loadProgram('add');

  return {
    id: 'machine',
    scene,
    camera,
    controls,
    labels,
    leftEl,
    rightEl,
    badge: 'L4 · STORED PROGRAM COMPUTER',
    caption: '取指 → 译码 → 执行：4 位累加器用 4 只三极管的亮灭显示二进制，内存里既放程序也放数据。点"微步"看每一步。',
    update,
    resize(w, h) {
      camera.aspect = w / h;

      camera.zoom = Math.min(1.3, Math.max(1, (w / h) / 0.95));
      camera.updateProjectionMatrix();
    },
    onActivate() {
      controls.enabled = true;
      renderAll();
    },
    onDeactivate() {
      controls.enabled = false;
    },
    onPointerMove() {},
    onPointerClick() {},
  };
}
