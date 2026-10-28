/**
 * 构建：把 three.js + 全部源码 + 样式打成【一个 HTML 文件】。
 * 产物：dist/index.html —— 双击即可离线运行，方便课堂分发 / U 盘拷贝。
 * 用法：
 *   node build.mjs            # 压缩版
 *   node build.mjs --dev      # 不压缩，报错时堆栈更可读
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  write: false,
  format: 'esm',
  target: ['es2020'],
  outdir: path.join(root, '.esbuild'),
  minify: !dev,
  sourcemap: false,
  legalComments: 'none',
  loader: { '.css': 'css', '.png': 'dataurl', '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const jsFile = result.outputFiles.find((f) => f.path.endsWith('.js'));
const cssFile = result.outputFiles.find((f) => f.path.endsWith('.css'));
let js = jsFile ? jsFile.text : '';
const css = cssFile ? cssFile.text : '';

// 内联 <script> 时避免提前闭合
js = js.replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// 注意：替换内容里含 $& 等序列，必须用函数式替换，否则会被当成正则替换模式
const inline = `<style>\n${css}\n</style>\n<script type="module">\n${js}\n</script>`;
html = html
  .split('<link rel="stylesheet" href="/src/style.css" />')
  .join('')
  .split('<script type="module" src="/src/main.js"></script>')
  .join(inline);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'index.html');
fs.writeFileSync(outFile, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ 构建完成：${path.relative(root, outFile)}  (${kb} KB)${dev ? '  [dev]' : ''}`);
