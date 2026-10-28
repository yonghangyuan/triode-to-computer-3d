/**
 * 无头浏览器截图 / 冒烟测试
 * 用法：
 *   node tools/shot.mjs --scene triode --out tools/shots/1-triode.png
 *   node tools/shot.mjs --url dist/index.html --scene machine --out x.png --width 1600 --height 1000
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const width = Number(getArg('width', '1600'));
const height = Number(getArg('height', '1000'));
const scene = getArg('scene', 'triode');
const out = path.resolve(root, getArg('out', `tools/shots/${scene}.png`));
const pageUrl = getArg('url', `dist/index.html`);
const waitMs = Number(getArg('wait', '2200'));
const click = getArg('click', null);
const evalCode = getArg('eval', null);

const url = pageUrl.startsWith('http') || pageUrl.startsWith('file:')
  ? pageUrl
  : `file:///${path.resolve(root, pageUrl).replace(/\\/g, '/')}?skip`;

fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

const errors = [];
const logs = [];
page.on('console', (msg) => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
try {
  await page.waitForFunction('window.__DSH3D__ !== undefined', { timeout: 15000 });
} catch (err) {
  console.error('页面初始化失败，控制台输出如下：');
  console.error(JSON.stringify({ errors, logs }, null, 2));
  await page.screenshot({ path: out });
  await browser.close();
  process.exit(3);
}
if (scene && scene !== 'none') {
  await page.evaluate((id) => window.__DSH3D__.activate(id), scene);
}
await new Promise((r) => setTimeout(r, waitMs));

if (click) {
  const [x, y] = click.split(',').map(Number);
  await page.mouse.click(x, y);
  await new Promise((r) => setTimeout(r, 900));
}

if (evalCode) {
  try {
    const evalResult = await page.evaluate(evalCode);
    console.log('EVAL:', JSON.stringify(evalResult, null, 2));
  } catch (err) {
    console.error('EVAL ERROR:', err.message);
  }
  await new Promise((r) => setTimeout(r, 800));
}

const info = await page.evaluate(() => {
  const r = window.__DSH3D__?.renderer;
  const active = window.__DSH3D__?.active;
  return {
    webgl: r ? r.getContext().getParameter(r.getContext().VERSION) : null,
    scene: active?.meta?.id || null,
    labels: active?.instance?.labels?.length || 0,
    stage: (() => {
      const el = document.getElementById('stage');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    })(),
  };
});

await page.screenshot({ path: out });
await browser.close();

console.log(JSON.stringify({ out, scene, info, errors, logs: logs.slice(-30) }, null, 2));
if (errors.length) process.exitCode = 2;
