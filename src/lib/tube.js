import * as THREE from 'three';

/** 生成一条螺旋线（用于栅极、灯丝） */
export function helixCurve(radius, y0, y1, turns, segments = 260) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, y0 + (y1 - y0) * t, Math.sin(a) * radius));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** 径向渐变贴图：光晕 / 接触阴影 */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 文字贴图：用于机柜上的数字窗口 / 内存单元 */
export function textTexture(text, {
  width = 256,
  height = 128,
  color = '#ffb454',
  glow = 'rgba(255,180,84,0.45)',
  bg = 'rgba(8,18,30,0.92)',
  font = '600 86px "Cascadia Mono", Consolas, monospace',
  letterSpacing = 0,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 26;
  }
  ctx.fillStyle = color;
  if (letterSpacing) {
    const chars = String(text).split('');
    const total = chars.length;
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const gapTotal = letterSpacing * (total - 1);
    const all = widths.reduce((a, b) => a + b, 0) + gapTotal;
    let x = width / 2 - all / 2;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, x + widths[i] / 2, height / 2 + 4);
      x += widths[i] + letterSpacing;
    });
  } else {
    ctx.fillText(String(text), width / 2, height / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, canvas: c, ctx, draw: () => { tex.needsUpdate = true; } };
}

/** 给任意 Object3D 的子网格统一设置一个可交互的部件名 */
export function tagPart(object, part, pickables) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.userData.part = part;
      pickables.push(child);
    }
  });
}

/**
 * 真空三极管 3D 模型。
 * 局部坐标：玻璃管竖直放置，管座底部约在 y=-1.2，管顶约在 y=+1.2。
 */
export function createTriode({ scale = 1 } = {}) {
  const group = new THREE.Group();
  const pickables = [];
  const parts = {};

  // ---------- 材质 ----------
  const bakelite = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.6, metalness: 0.12 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6d798a, roughness: 0.34, metalness: 0.9 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3d4757, roughness: 0.45, metalness: 0.85 });
  const mica = new THREE.MeshStandardMaterial({
    color: 0x6a5f50, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbcd9f6,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.045,
    side: THREE.FrontSide,
    depthWrite: false,
    clearcoat: 0.22,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.55,
  });
  const filamentMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a10, emissive: 0xff9a3c, emissiveIntensity: 0, roughness: 0.5, metalness: 0.6,
  });
  const cathodeMat = new THREE.MeshStandardMaterial({
    color: 0x9daab8, emissive: 0xff8a3c, emissiveIntensity: 0, roughness: 0.48, metalness: 0.55,
    side: THREE.DoubleSide,
  });
  const gridMat = new THREE.MeshStandardMaterial({
    color: 0x9fb0c6, emissive: 0x2f6bff, emissiveIntensity: 0, roughness: 0.5, metalness: 0.35,
    envMapIntensity: 0.1,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x5c6c82, emissive: 0xff5a1e, emissiveIntensity: 0, roughness: 0.55, metalness: 0.45,
    envMapIntensity: 0.1, side: THREE.DoubleSide,
  });

  // ---------- 管座 ----------
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.34, 48), bakelite);
  base.position.y = -1.0;
  parts.base = base;
  group.add(base);
  tagPart(base, 'base', pickables);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.545, 0.545, 0.07, 48), darkSteel);
  collar.position.y = -0.8;
  group.add(collar);

  // 管脚
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.35;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 12), steel);
    pin.position.set(Math.cos(a) * 0.34, -1.27, Math.sin(a) * 0.34);
    group.add(pin);
  }
  // 管座定位凸起
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), darkSteel);
  key.position.set(0, -1.18, 0.58);
  group.add(key);

  // ---------- 玻璃外壳 ----------
  const glassBody = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.22, 48, 1, true), glass);
  glassBody.position.y = -0.16;
  parts.glass = glassBody;
  group.add(glassBody);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  dome.scale.set(1, 0.58, 1);
  dome.position.y = 0.45;
  group.add(dome);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 16), glass);
  tip.position.y = 0.78;
  group.add(tip);
  tagPart(glassBody, 'glass', pickables);
  tagPart(dome, 'glass', pickables);

  // 玻璃上的高光条（让透明管有体积感）
  const sheen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.505, 0.505, 1.18, 32, 1, true, -0.55, 0.5),
    new THREE.MeshBasicMaterial({
      color: 0x9fd0ff, transparent: true, opacity: 0.05, side: THREE.FrontSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  sheen.position.y = -0.17;
  group.add(sheen);

  // ---------- 电极组件（剖切展示：所有筒状电极朝 +z 开一个缺口） ----------
  // 教学模型把筒状电极做成"剖切"形态，让内部电极层一眼可见，像剖开的机器图。
  const FRONT_GAP = 1.25; // 正前方的缺口（弧度）
  const GAP_START = FRONT_GAP / 2;
  const GAP_LEN = Math.PI * 2 - FRONT_GAP;

  // 阴极（发射电子的套筒，内部藏着灯丝）
  const cathode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.56, 32, 1, true, GAP_START, GAP_LEN),
    cathodeMat,
  );
  cathode.position.y = -0.08;
  parts.cathode = cathode;
  group.add(cathode);
  tagPart(cathode, 'cathode', pickables);

  // 阴极顶部小环（接引线）
  const cathodeTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.155, 0.008, 6, 40, GAP_LEN),
    cathodeMat,
  );
  cathodeTop.rotation.x = Math.PI / 2;
  cathodeTop.rotation.z = -Math.PI / 2 - GAP_START;
  cathodeTop.position.y = 0.2;
  group.add(cathodeTop);

  // 灯丝（阴极内部，加热用的钨丝）
  const filament = new THREE.Mesh(
    new THREE.TubeGeometry(helixCurve(0.062, -0.33, 0.12, 7, 200), 200, 0.011, 8, false),
    filamentMat,
  );
  parts.filament = filament;
  group.add(filament);
  tagPart(filament, 'filament', pickables);

  // 灯丝引线
  const leadMat = new THREE.MeshStandardMaterial({ color: 0x4c5666, roughness: 0.4, metalness: 0.85 });
  for (const sx of [-1, 1]) {
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), leadMat);
    lead.position.set(sx * 0.062, -0.58, 0);
    group.add(lead);
  }

  // 栅极（螺旋栅网）
  const grid = new THREE.Mesh(
    new THREE.TubeGeometry(helixCurve(0.265, -0.28, 0.18, 9, 300), 300, 0.008, 6, false),
    gridMat,
  );
  parts.grid = grid;
  group.add(grid);
  tagPart(grid, 'grid', pickables);

  // 栅极支柱（左右两根）
  for (const sx of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.72, 8), gridMat);
    rod.position.set(sx * 0.265, -0.05, 0);
    group.add(rod);
    tagPart(rod, 'grid', pickables);
  }

  // 屏极（阳极）：最外层金属筒，正面剖开
  const PLATE_GAP = 1.35;
  const pStart = PLATE_GAP / 2;
  const pLen = Math.PI * 2 - PLATE_GAP;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.74, 44, 1, true, pStart, pLen),
    plateMat,
  );
  plate.position.y = -0.03;
  parts.plate = plate;
  group.add(plate);
  tagPart(plate, 'plate', pickables);

  for (const y of [0.345, -0.4]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.37, 40, 1, pStart, pLen), plateMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
    tagPart(ring, 'plate', pickables);
  }

  // 云母隔离片
  for (const y of [-0.43, 0.37]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 40), mica);
    disc.position.y = y;
    group.add(disc);
  }

  // 栅极电场可视化（负压时出现）
  const fieldMat = new THREE.MeshBasicMaterial({
    color: 0x3f74ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fieldShell = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.66, 32, 1, true), fieldMat);
  fieldShell.position.y = -0.04;
  group.add(fieldShell);

  // 栅极受电子撞击的微弱光晕
  const gridGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.68, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x5fd8ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  gridGlow.position.y = -0.04;
  group.add(gridGlow);

  // 管内暖光：模拟阴极/灯丝把管腔照亮，让内部结构可读
  const interiorLight = new THREE.PointLight(0xffb066, 0, 1.5, 2);
  interiorLight.position.set(0, -0.02, 0.02);
  group.add(interiorLight);

  group.scale.setScalar(scale);

  /** 更新发光/状态 */
  function setState({ heat = 0, ipRatio = 0, vg = 0, cutaway = false, showGlass = true } = {}) {
    const h = Math.min(1.2, Math.max(0, heat));
    filamentMat.emissiveIntensity = 0.05 + h * 2.0;
    filamentMat.color.setRGB(0.25 + h * 0.55, 0.13 + h * 0.25, 0.06);
    cathodeMat.emissiveIntensity = h * 0.4;
    plateMat.emissiveIntensity = 0.008 + ipRatio * 0.2;
    gridMat.emissiveIntensity = 0.015 + Math.min(0.26, Math.max(0, -vg) / 34);
    fieldMat.opacity = Math.min(0.13, Math.max(0, -vg) / 55);
    gridGlow.material.opacity = Math.min(0.08, Math.max(0, -vg) / 90);
    interiorLight.intensity = 0.025 + ipRatio * 0.03;
    const g = cutaway ? 0 : (showGlass ? 0.06 : 0);
    glass.opacity = g;
    glassBody.visible = g > 0.005;
    dome.visible = g > 0.005;
    tip.visible = g > 0.005;
    sheen.visible = g > 0.005;
  }

  return { group, parts, pickables, setState, materials: { glass, gridMat, plateMat, filamentMat, cathodeMat } };
}

/** 管脚说明（供交互面板使用） */
export const PART_INFO = {
  filament: {
    name: '灯丝 / 加热器',
    en: 'FILAMENT',
    text: '通电后烧到约 2000 K，像白炽灯丝一样发红发热。它的任务不是导电，而是把阴极"烤热"，让电子获得足够能量逃逸出来。',
  },
  cathode: {
    name: '阴极',
    en: 'CATHODE',
    text: '表面涂有氧化物，受热后发射电子（热电子发射）。它是电子流的源头，通常接地，是电路中电子的"出发点"。',
  },
  grid: {
    name: '栅极',
    en: 'CONTROL GRID',
    text: '一圈细金属丝织成的"闸门"，套在阴极外面。栅极电压只要变化几伏，就能大幅改变到达屏极的电子数量——这正是"放大"的来源。栅极负得越多，电子越被顶回去。',
  },
  plate: {
    name: '屏极 / 阳极',
    en: 'PLATE / ANODE',
    text: '最外层的金属筒，接上百伏正高压，把穿过栅极的电子收集起来，形成屏极电流。它同时是输出端：电流流过负载电阻，就把电流变化变成了电压变化。',
  },
  glass: {
    name: '玻璃外壳',
    en: 'ENVELOPE',
    text: '抽成高真空并密封，让电子能自由飞行而不被空气分子撞散。早期电子管还要把内部抽到 10⁻⁶ 个大气压以下。',
  },
  base: {
    name: '管座 / 管脚',
    en: 'BASE · PINS',
    text: '胶木管座与金属管脚负责机械固定和电气连接。电子管要经常插拔更换，所以插脚式封装是那个时代的"标准接口"。',
  },
};
