/**
 * 真空三极管的教学用简化物理模型
 * ------------------------------------------------------------------
 * 真实三极管是三维静电场 + 空间电荷限制发射问题，工程上通常查特性曲线。
 * 这里用两条物理上站得住的规律做出"可解释、可交互"的模型：
 *
 *  1) 热电子发射（Richardson–Dushman 的简化）：灯丝越热，阴极能发射的电子越多，
 *     且对温度极其敏感（近似为灯丝电压的高次幂）。
 *  2) 空间电荷限制定律（Child–Langmuir 的三极管形式）：
 *        Ip = K · (Vg + Vp/μ)^(3/2)     当 Vg + Vp/μ > 0，否则 Ip = 0（截止）
 *     它解释了为什么栅极上的几伏负压，就能控制屏极上百伏的电流。
 *
 * 教学参数取常见小功率三极管量级：μ = 20，Vbb = 160 V，Rp = 8 kΩ。
 */

export const TUBE = {
  mu: 20, // 放大系数
  perveance: 1.75e-3, // K，单位 A/V^1.5
  emissionMax: 0.03, // A，额定灯丝电压下的最大发射
  vfNominal: 6.3, // V，额定灯丝电压
  vbb: 160, // V，屏极电源
  rp: 8000, // Ω，屏极负载电阻
  vpMax: 250,
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** 灯丝电压 → 阴极温度 / 饱和发射电流（教学估算） */
export function cathodeState(vf) {
  const heat = clamp(vf / TUBE.vfNominal, 0, 1.25);
  const temp = 300 + 2150 * Math.pow(heat, 0.85); // K
  const emission = TUBE.emissionMax * Math.pow(heat, 5.5); // A
  return { heat, temp, emission };
}

/** 屏极电流（A）：Vg + Vp/μ > 0 才导通 */
export function plateCurrent(vp, vg, vf) {
  const { emission } = cathodeState(vf);
  const effective = vg + vp / TUBE.mu;
  if (effective <= 0) return 0;
  return Math.min(TUBE.perveance * Math.pow(effective, 1.5), emission);
}

/** 屏极电流（mA），画图用 */
export const plateCurrentMa = (vp, vg, vf) => plateCurrent(vp, vg, vf) * 1000;

/**
 * 由负载线求静态工作点：Vp = Vbb − Ip·Rp
 * 方程单调，用二分法求根。
 */
export function operatingPoint(vg, vf, vbb = TUBE.vbb, rp = TUBE.rp) {
  const f = (vp) => vp + plateCurrent(vp, vg, vf) * rp - vbb;
  let lo = 0;
  let hi = vbb;
  for (let i = 0; i < 42; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  const vp = (lo + hi) / 2;
  const ip = plateCurrent(vp, vg, vf);
  const eff = vg + vp / TUBE.mu;
  const state = eff <= 0.05 ? 'cutoff' : vp < 28 ? 'sat' : 'amp';
  // 跨导 gm = ∂Ip/∂Vg（在 Vp 固定处求数值导数）
  const dv = 0.05;
  const gm = (plateCurrent(vp, vg + dv, vf) - plateCurrent(vp, vg - dv, vf)) / (2 * dv);
  // 共阴放大器的电压增益（忽略内阻）：Av ≈ −gm·Rp
  const gain = gm * rp;
  return { vp, ip, state, gm, gain, eff };
}

/** 逻辑电平约定（教学用，源自电子管时代"负栅压截止"的做法）
 *  - 栅极输入：逻辑 1 = 0 V；逻辑 0 = −6 V（负压把电子"闸"回去）
 *  - 屏极输出：逻辑 1 = 高压（接近 Vbb）；逻辑 0 = 低压（≈ 10–20 V）
 */
export const LEVEL = {
  vgHigh: 0,
  vgLow: -6,
  vpHigh: 160,
  vpLow: 12,
};

export const vgOf = (bit) => (bit ? LEVEL.vgHigh : LEVEL.vgLow);
export const bitOfVp = (vp, vbb = TUBE.vbb) => (vp > vbb * 0.5 ? 1 : 0);
