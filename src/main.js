import './style.css';
import * as THREE from 'three';
import { SCENES } from './scenes/index.js';

const $ = (id) => document.getElementById(id);
const stageEl = $('stage');
const labelsEl = $('labels');
const canvas = $('gl');
const tabsEl = $('tabs');
const panelLeft = $('panel-left');
const panelRight = $('panel-right');
const badgeEl = $('stage-badge');
const captionEl = $('stage-caption');
const modal = $('modal');

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.matchMedia('(max-width: 900px)').matches ? 1.6 : 2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
renderer.setClearColor(0x000000, 0);

/* ------------------------------------------------------------------ 场景 */
const cache = new Map();
const state = { active: null, width: 1, height: 1, meta: SCENES[0] };
const labelsRoot = labelsEl;

function makeLabel(text, anchor, opts = {}) {
  const el = document.createElement('div');
  el.className = `lbl${opts.amber ? ' amber' : ''}`;
  el.innerHTML = `<span class="dot"></span><span>${text}</span>`;
  labelsRoot.appendChild(el);
  return {
    el,
    anchor: anchor.clone ? anchor.clone() : new THREE.Vector3(anchor.x, anchor.y, anchor.z),
    offset: opts.offset || { x: 0, y: 0 },
    part: opts.part || null,
    hidden: false,
  };
}

function buildScene(meta) {
  const ctx = { renderer, stageEl, labelsEl, makeLabel };
  const instance = meta.create(ctx);
  if (instance.badge) instance.badgeText = instance.badge;
  return instance;
}

function getInstance(meta) {
  if (!cache.has(meta.id)) cache.set(meta.id, buildScene(meta));
  return cache.get(meta.id);
}

function hideAllLabels() {
  labelsRoot.querySelectorAll('.lbl').forEach((el) => { el.style.display = 'none'; });
}

function activate(meta) {
  if (state.active && state.active.meta.id === meta.id) return;
  if (state.active) state.active.instance.onDeactivate?.();
  hideAllLabels();

  const instance = getInstance(meta);
  state.active = { meta, instance };
  state.meta = meta;

  panelLeft.replaceChildren(instance.leftEl);
  panelRight.replaceChildren(instance.rightEl);
  panelLeft.scrollTop = 0;
  panelRight.scrollTop = 0;
  badgeEl.textContent = instance.badge || '';
  captionEl.textContent = instance.caption || '';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === meta.id));
  instance.resize(state.width, state.height);
  instance.onActivate?.();
  renderer.domElement.style.cursor = 'grab';
  if (typeof setDrawer === 'function') setDrawer(null);
}

/* ------------------------------------------------------------------- 标签 */
const projected = new THREE.Vector3();
function updateLabels(instance) {
  const rect = stageEl.getBoundingClientRect();
  for (const lab of instance.labels || []) {
    if (lab.hidden) { lab.el.style.display = 'none'; continue; }
    projected.copy(lab.anchor).project(instance.camera);
    const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.3 && Math.abs(projected.y) < 1.3;
    if (!visible) { lab.el.style.display = 'none'; continue; }
    let x = (projected.x * 0.5 + 0.5) * rect.width + (lab.offset?.x || 0);
    let y = (-projected.y * 0.5 + 0.5) * rect.height + (lab.offset?.y || 0);
    x = clamp(x, 64, rect.width - 64);
    y = clamp(y, 22, rect.height - 22);
    lab.el.style.display = '';
    lab.el.style.left = `${x}px`;
    lab.el.style.top = `${y}px`;
  }
}

/* ------------------------------------------------------------------- 循环 */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const active = state.active;
  if (!active) return;
  const instance = active.instance;
  instance.update?.(dt, t);
  renderer.render(instance.scene, instance.camera);
  updateLabels(instance);
}
requestAnimationFrame(tick);

/* ------------------------------------------------------------------- 尺寸 */
function resize() {
  const rect = stageEl.getBoundingClientRect();
  state.width = Math.max(2, Math.round(rect.width));
  state.height = Math.max(2, Math.round(rect.height));
  renderer.setSize(state.width, state.height, false);
  state.active?.instance.resize(state.width, state.height);
}
new ResizeObserver(resize).observe(stageEl);
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------- 指针 */
const raycasterNdc = new THREE.Vector2();
let down = null;

function toNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  raycasterNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  return raycasterNdc;
}

canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 7) return; // 拖动旋转，不算点击
  state.active?.instance.onPointerClick?.(toNdc(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (!state.active) return;
  state.active.instance.onPointerMove?.(toNdc(e));
});
canvas.addEventListener('pointerleave', () => {
  canvas.style.cursor = 'grab';
});

/* ------------------------------------------------------------------- 标签页 */
SCENES.forEach((meta) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tab';
  btn.dataset.id = meta.id;
  btn.innerHTML = `<span class="tab-idx">${meta.idx}</span><span class="tab-name">${meta.name}</span>`;
  btn.title = meta.desc;
  btn.addEventListener('click', () => activate(meta));
  tabsEl.appendChild(btn);
});

/* ------------------------------------------------------------- 手机端抽屉面板 */
const appEl = $('app');
const scrimEl = $('drawer-scrim');
const drawerButtons = {
  left: $('btn-drawer-left'),
  right: $('btn-drawer-right'),
};

function setDrawer(side) {
  const isOpen = side === 'left' ? appEl.classList.contains('show-left') : appEl.classList.contains('show-right');
  const target = side && !isOpen ? side : null;
  appEl.classList.toggle('show-left', target === 'left');
  appEl.classList.toggle('show-right', target === 'right');
  scrimEl.classList.toggle('show', Boolean(target));
  drawerButtons.left.classList.toggle('active', target === 'left');
  drawerButtons.right.classList.toggle('active', target === 'right');
}

drawerButtons.left.addEventListener('click', () => setDrawer('left'));
drawerButtons.right.addEventListener('click', () => setDrawer('right'));
scrimEl.addEventListener('click', () => setDrawer(null));
window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
  if (e.matches) setDrawer(null);
});

/* ------------------------------------------------------------------- 导览弹窗 */
const levelsEl = $('modal-levels');
levelsEl.innerHTML = SCENES.map((m) => `
  <div class="modal-level">
    <span class="lv">${m.idx}</span>
    <div>
      <h3>${m.name} <span style="color:var(--ink-faint);font-family:var(--mono);font-size:9px;letter-spacing:.12em">${m.en}</span></h3>
      <p>${m.desc}</p>
    </div>
  </div>
`).join('');

function openModal() { modal.hidden = false; }
function closeModal() { modal.hidden = true; }

$('modal-enter').addEventListener('click', closeModal);
$('modal-close').addEventListener('click', closeModal);
$('btn-tour').addEventListener('click', openModal);
$('btn-help').addEventListener('click', openModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); setDrawer(null); }
  const n = Number(e.key);
  if (n >= 1 && n <= SCENES.length) activate(SCENES[n - 1]);
});

/* ------------------------------------------------------------------- 启动 */
const params = new URLSearchParams(location.search);
activate(SCENES[0]);
resize();
if (!params.has('skip')) openModal();

// 便于调试 / 自动化截图：把内部状态挂到 window
window.__DSH3D__ = {
  activate: (id) => {
    const meta = SCENES.find((m) => m.id === id);
    if (meta) activate(meta);
  },
  get active() { return state.active; },
  renderer,
};
