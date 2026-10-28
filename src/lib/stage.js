import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { radialTexture } from './tube.js';

/** 影棚布光：冷色环境 + 暖色灯丝补光 + 蓝色轮廓光 */
export function addStudioLighting(scene, { warm = 0xffb070, warmIntensity = 0.3 } = {}) {
  scene.add(new THREE.HemisphereLight(0x9dc4ff, 0x0a1420, 0.9));
  scene.add(new THREE.AmbientLight(0x33465e, 0.7));

  const key = new THREE.DirectionalLight(0xfff2e0, 2.3);
  key.position.set(3.2, 5.2, 4.0);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x6fa8ff, 1.15);
  fill.position.set(-4.2, 2.4, -2.6);
  scene.add(fill);

  const rim = new THREE.PointLight(0x4f86ff, 11, 14, 2);
  rim.position.set(-2.6, 1.8, -2.4);
  scene.add(rim);

  const warmLight = new THREE.PointLight(warm, warmIntensity * 4.5, 8, 2);
  warmLight.position.set(0, 0.2, 2.0);
  scene.add(warmLight);

  const under = new THREE.PointLight(0xff9a5c, 0.55, 5, 2);
  under.position.set(0, -1.05, 0.6);
  scene.add(under);

  return { key, fill, rim, warmLight, under };
}

/** 圆形实验台 + 发光环 */
export function createPlatform({ y = -1.42, radius = 1.9, color = 0xff9a3c, opacity = 0.16 } = {}) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.015, 0.1, 96),
    new THREE.MeshStandardMaterial({ color: 0x1b2c42, metalness: 0.62, roughness: 0.45 }),
  );
  body.position.y = y;
  group.add(body);

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.012, 96),
    new THREE.MeshStandardMaterial({ color: 0x22384f, metalness: 0.5, roughness: 0.6 }),
  );
  inner.position.y = y + 0.055;
  group.add(inner);

  // 发光边环
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.985, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y + 0.05;
  group.add(ring);

  for (const r of [0.55, 0.95, 1.35]) {
    const grid = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.0035, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.16 }),
    );
    grid.rotation.x = Math.PI / 2;
    grid.position.y = y + 0.055;
    group.add(grid);
  }

  // 台面光晕
  const glowTex = radialTexture('rgba(255,160,70,0.85)', 'rgba(255,160,70,0)');
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 3.2, radius * 3.2),
    new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = y + 0.06;
  group.add(glow);

  group.userData.ring = ring;
  group.userData.glow = glow;
  return group;
}

/** 深色金属机箱底板 */
export function createChassis({
  width = 4.4, depth = 2.6, height = 0.16, y = -0.08, color = 0x0b1522,
} = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 4, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x1a2b42, metalness: 0.5, roughness: 0.55 }),
  );
  body.position.y = y;
  group.add(body);

  // 面板上的一圈细边（发光）
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 0.995, height * 1.02, depth * 0.995)),
    new THREE.LineBasicMaterial({ color: 0x4f86ff, transparent: true, opacity: 0.32 }),
  );
  edge.position.y = y;
  group.add(edge);

  // 铭牌
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.24, 0.006, depth * 0.06),
    new THREE.MeshStandardMaterial({ color: 0x3a4a5e, metalness: 0.9, roughness: 0.3 }),
  );
  plate.position.set(-width * 0.31, y + height * 0.5 + 0.004, depth * 0.4);
  group.add(plate);

  group.userData.body = body;
  return group;
}

/** 管座 */
export function createSocket({ x = 0, y = 0, z = 0, radius = 0.3 } = {}) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.06, 0.07, 40),
    new THREE.MeshStandardMaterial({ color: 0x2a1f18, metalness: 0.3, roughness: 0.68 }),
  );
  base.position.y = 0.035;
  group.add(base);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.01, 0.011, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.28 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.072;
  group.add(ring);
  group.position.set(x, y, z);
  return group;
}

/** 圆柱形线绕电阻 */
export function createResistor({ length = 0.9, radius = 0.055, color = 0x8a6a4a } = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), bodyMat);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.4, metalness: 0.4 });
  for (const sx of [-0.24, 0, 0.24]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.045, 24), bandMat);
    band.rotation.z = Math.PI / 2;
    band.position.x = sx * length;
    group.add(band);
  }
  const leadMat = new THREE.MeshStandardMaterial({ color: 0x9aa8b8, metalness: 0.9, roughness: 0.3 });
  for (const sx of [-1, 1]) {
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 10), leadMat);
    lead.rotation.z = Math.PI / 2;
    lead.position.x = sx * (length / 2 + 0.12);
    group.add(lead);
  }
  return group;
}

/** 板面上的发光走线（用扁平长方体 + 发光材质，便于指示电平） */
export function createTrace(points, { width = 0.055, y = 0.005, color = 0x2a3a4c, emissive = 0xff9a3c } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: 0.15, metalness: 0.4, roughness: 0.45,
  });
  const group = new THREE.Group();
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.014, width), mat);
    seg.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    seg.rotation.y = -Math.atan2(dz, dx);
    group.add(seg);
  }
  group.userData.material = mat;
  return group;
}

/** 指示灯泡（带光晕） */
export function createLamp({ radius = 0.09, color = 0xffb454 } = {}) {
  const group = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0x3a2a1c, emissive: color, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.1,
    }),
  );
  group.add(bulb);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 6, radius * 6),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,180,84,0.9)', 'rgba(255,180,84,0)'),
      transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  halo.position.z = 0.02;
  group.add(halo);
  group.userData = {
    bulb,
    halo,
    set(on, intensity = 1) {
      bulb.material.emissiveIntensity = on ? 0.45 + 0.9 * intensity : 0.05;
      bulb.material.color.setHex(on ? 0xffc980 : 0x2a2f38);
      halo.material.opacity = on ? 0.1 + 0.16 * intensity : 0;
      halo.visible = on;
    },
  };
  group.userData.set(false);
  return group;
}

/** 接线柱 */
export function createPost({ color = 0xff9a3c, height = 0.14, radius = 0.045 } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb9c6d6, metalness: 0.95, roughness: 0.22 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), mat);
  post.position.y = height / 2;
  group.add(post);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.15, 16, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 }),
  );
  cap.position.y = height;
  group.add(cap);
  return group;
}

/** 立体弧形导线：用管状几何 + 发光材质表示电平和电流 */
export function createWire(points, { color = 0xffb454, radius = 0.016, emissiveIntensity = 0.35 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mat = new THREE.MeshStandardMaterial({
    color: 0x16202d,
    emissive: color,
    emissiveIntensity,
    metalness: 0.5,
    roughness: 0.35,
  });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, 8, false), mat);
  mesh.userData.material = mat;
  return mesh;
}

/** 地面渐隐雾面（营造空间纵深） */
export function createVignettePlane() {
  const tex = radialTexture('rgba(10,24,44,0)', 'rgba(2,5,10,0.9)');
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.5;
  return mesh;
}
