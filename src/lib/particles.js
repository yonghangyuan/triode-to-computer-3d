import * as THREE from 'three';

/**
 * 电子流粒子系统（教学可视化）
 * ------------------------------------------------------------------
 * 每个粒子在圆柱坐标里沿半径方向运动：
 *   阴极表面(r=rc) → 栅极(r=rg) → 屏极(r=rp) → 消失/重新发射
 * 到达栅极平面时按"通过率" p = Ip / Iem 抽样：
 *   - 通过的继续飞向屏极（亮青色）
 *   - 被栅极推回的减速、反向飞回阴极附近并重新发射（橙色，形成空间电荷云）
 * 电子数量随发射电流缩放（setDrawRange），从而"电流大小看得见"。
 */
export function createElectronFlow({
  count = 900,
  rc = 0.185,
  rg = 0.305,
  rp = 0.425,
  yMin = -0.33,
  yMax = 0.26,
  colorForward = new THREE.Color(0x4fd0ff),
  colorReturn = new THREE.Color(0xff8a3c),
  size = 0.017,
} = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const state = new Float32Array(count); // 0=向外, 1=向内
  const angle = new Float32Array(count);
  const yPos = new Float32Array(count);
  const radius = new Float32Array(count);
  const speed = new Float32Array(count);
  const drift = new Float32Array(count);
  const hidden = new Uint8Array(count);

  function reseed(i) {
    angle[i] = Math.random() * Math.PI * 2;
    yPos[i] = yMin + Math.random() * (yMax - yMin);
    radius[i] = rc + Math.random() * 0.01;
    speed[i] = 0.9 + Math.random() * 1.5;
    drift[i] = (Math.random() - 0.5) * 0.12;
    state[i] = 0;
    hidden[i] = 0;
  }

  for (let i = 0; i < count; i += 1) reseed(i);

  function respawn(i) {
    reseed(i);
  }

  /**
   * @param {number} dt 秒
   * @param {object} o
   * @param {number} o.emission 归一化发射强度 0..1（决定可见粒子数）
   * @param {number} o.passRatio 通过率 Ip/Iem 0..1（栅极"闸门"开度）
   * @param {number} o.vp 屏极电压归一化（吸引强度，可选）
   */
  function update(dt, { emission = 0, passRatio = 0, vp = 1 } = {}) {
    const active = Math.round(count * Math.min(1, Math.max(0, emission)));
    const d = Math.min(0.05, dt);

    for (let i = 0; i < active; i += 1) {
      const boost = 0.85 + vp * 0.35;
      const v = speed[i] * boost * d;
      if (state[i] === 0) {
        // 向外飞
        radius[i] += v;
        // 轻微的纵向漂移，让电子云有体积感
        yPos[i] += drift[i] * d;
        if (radius[i] >= rg && radius[i] - v < rg) {
          if (Math.random() > passRatio) {
            state[i] = 1; // 被栅极推回
            radius[i] = rg - 0.002;
          }
        }
        if (radius[i] >= rp) respawn(i);
      } else {
        // 被推回阴极
        radius[i] -= v * 0.8;
        yPos[i] += drift[i] * d * 0.5;
        if (radius[i] <= rc + 0.012) respawn(i);
      }

      // 边界：纵向夹紧在电极区域内
      if (yPos[i] < yMin) yPos[i] = yMin;
      if (yPos[i] > yMax) yPos[i] = yMax;

      const a = angle[i];
      const r = radius[i];
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = yPos[i];
      positions[i * 3 + 2] = Math.sin(a) * r;

      const c = state[i] === 0 ? colorForward : colorReturn;
      // 越靠近屏极越亮
      const t = Math.min(1, Math.max(0, (r - rc) / (rp - rc)));
      const k = 0.35 + t * 0.5;
      colors[i * 3] = c.r * k;
      colors[i * 3 + 1] = c.g * k;
      colors[i * 3 + 2] = c.b * k;
    }

    // 隐藏未激活粒子（挪到画面外）
    for (let i = active; i < count; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -999;
      positions[i * 3 + 2] = 0;
    }

    geometry.setDrawRange(0, active);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  return {
    points,
    update,
    setVisible(v) { points.visible = v; },
    setSize(s) { material.size = s; },
    material,
  };
}
