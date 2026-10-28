/**
 * 交互冒烟测试：依次打开 4 个层次，操作主要控件，检查报错与状态变化。
 * 用法：node tools/smoke.mjs
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = `file:///${path.resolve(root, 'dist/index.html').replace(/\\/g, '/')}?skip`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__DSH3D__ !== undefined', { timeout: 20000 });
await sleep(800);

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// ---------- L1 三极管 ----------
await page.evaluate(() => window.__DSH3D__.activate('triode'));
await sleep(900);
let r = await page.evaluate(() => {
  const setRange = (id, v) => {
    const el = document.getElementById(id);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setRange('vf', 5.2);
  setRange('vg', -7.5);
  setRange('vbb', 180);
  const ip = document.getElementById('ro-ip')?.textContent;
  const state = document.getElementById('ro-state')?.textContent;
  // 切到数字开关模式
  document.querySelector('#mode-seg button[data-mode="switch"]')?.click();
  return { ip, state, switchVisible: !document.getElementById('switch-box')?.hidden };
});
check('L1 滑杆与模式切换', Boolean(r.ip) && r.switchVisible, JSON.stringify(r));
r = await page.evaluate(() => {
  document.getElementById('sw-a')?.click();
  return document.getElementById('sw-a-state')?.textContent;
});
check('L1 数字开关翻转', typeof r === 'string' && r.includes('0'), String(r));

// ---------- L2 逻辑门 ----------
await page.evaluate(() => window.__DSH3D__.activate('logic'));
await sleep(900);
r = await page.evaluate(() => {
  const b = document.getElementById('sw-b');
  b?.click();
  const out = document.getElementById('ro-out')?.textContent;
  const activeRow = document.querySelector('#truth-body tr.active')?.textContent?.replace(/\s+/g, '');
  document.getElementById('btn-auto')?.click();
  return { out, activeRow };
});
check('L2 真值表联动', Boolean(r.activeRow) && r.activeRow.length > 0, JSON.stringify(r));
await sleep(1800);
r = await page.evaluate(() => document.getElementById('ro-out')?.textContent);
check('L2 自动遍历运行', typeof r === 'string' && r.startsWith('OUT'), String(r));
await page.evaluate(() => document.getElementById('btn-auto')?.click());

// ---------- L3 触发器 / 计数器 ----------
await page.evaluate(() => window.__DSH3D__.activate('memory'));
await sleep(900);
r = await page.evaluate(() => {
  document.getElementById('btn-reset')?.click();
  const q = document.getElementById('ff-big')?.textContent;
  document.querySelector('#mode-seg button[data-mode="counter"]')?.click();
  document.getElementById('btn-clock')?.click();
  document.getElementById('btn-clock')?.click();
  return { q, bin: document.getElementById('cnt-binary')?.textContent };
});
check('L3 触发器置零 + 计数器计数', r.q?.includes('0') && r.bin === '0010', JSON.stringify(r));
r = await page.evaluate(() => {
  document.getElementById('btn-auto-clock')?.click();
  return document.getElementById('btn-auto-clock')?.textContent;
});
await sleep(1400);
check('L3 自动时钟启动', typeof r === 'string' && r.includes('停止'), String(r));
await page.evaluate(() => document.getElementById('btn-auto-clock')?.click());

// ---------- L4 计算机 ----------
await page.evaluate(() => window.__DSH3D__.activate('machine'));
await sleep(900);
r = await page.evaluate(() => {
  for (let i = 0; i < 4; i += 1) document.getElementById('btn-micro')?.click();
  return {
    pc: document.getElementById('ro-pc')?.textContent,
    ir: document.getElementById('ro-ir')?.textContent,
    logCount: document.querySelectorAll('#log li').length,
    stageActive: document.querySelector('#pipeline .stage-chip.active')?.textContent,
  };
});
check('L4 微步执行', Number(r.pc) === 1 && r.logCount >= 4, JSON.stringify(r));
r = await page.evaluate(() => {
  for (let i = 0; i < 3; i += 1) document.getElementById('btn-instr')?.click();
  return { acc: document.getElementById('ro-acc')?.textContent, out: document.getElementById('ro-out')?.textContent };
});
check('L4 整条指令 + 加法结果', r.acc === '8' && r.out === '8', JSON.stringify(r));
r = await page.evaluate(() => {
  document.querySelector('#program-btns button[data-prog="loop"]')?.click();
  const hz = document.getElementById('hz');
  hz.value = '20';
  hz.dispatchEvent(new Event('input', { bubbles: true }));
  const btn = document.getElementById('btn-run');
  btn?.click();
  return { title: document.getElementById('prog-title')?.textContent, running: btn?.textContent };
});
await sleep(6000);
r = await page.evaluate(() => ({
  running: document.getElementById('btn-run')?.textContent,
  outputs: document.getElementById('out-values')?.textContent,
  logCount: document.querySelectorAll('#log li').length,
  halted: document.getElementById('ro-state')?.textContent,
}));
check('L4 运行循环程序', r.logCount > 5 && /1\s*→\s*2/.test(r.outputs || ''), JSON.stringify(r));
await page.evaluate(() => document.getElementById('btn-run')?.click());

const finalState = await page.evaluate(() => ({
  scene: window.__DSH3D__.active?.meta?.id,
  webgl: Boolean(window.__DSH3D__.renderer),
}));

await browser.close();

const failed = results.filter((x) => !x.ok);
const report = { results, errors, finalState, ok: failed.length === 0 && errors.length === 0 };
console.log(JSON.stringify(report, null, 2));
fs.mkdirSync(path.join(root, 'tools/shots'), { recursive: true });
fs.writeFileSync(path.join(root, 'tools/shots/smoke-report.json'), JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 4;
