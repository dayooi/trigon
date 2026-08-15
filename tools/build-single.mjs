/**
 * Bundle the game into one self-contained HTML file.
 *
 * No bundler, to match the rest of the project: the modules are concatenated
 * in dependency order with their import lines and `export` keywords stripped,
 * which works because nothing is re-exported and no two modules declare the
 * same top-level name. The script verifies that last assumption rather than
 * trusting it.
 *
 *   node tools/build-single.mjs [outfile]
 *
 * The result needs no server and no network: open it straight from disk.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? resolve(root, 'dist/trigon.html');

const read = (file) => readFileSync(resolve(root, file), 'utf8');

// Dependency order: each module only uses names declared above it.
const MODULES = [
  'src/geometry.js',
  'src/shapes.js',
  'src/game.js',
  'src/ui.js',
  'src/main.js',
];

const stripped = MODULES.map((file) => {
  const source = read(file)
    .replace(/^import\s+[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*\n/gm, '')
    .replace(/^export\s+/gm, '');
  return `/* ===== ${file} ===== */\n${source.trim()}\n`;
});

// Two modules declaring the same top-level name would silently clobber each
// other once concatenated, so fail loudly instead.
const declared = new Map();
stripped.forEach((source, i) => {
  const pattern = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const [, name] of source.matchAll(pattern)) {
    if (declared.has(name)) {
      throw new Error(
        `duplicate top-level name "${name}" in ${MODULES[i]} and ${declared.get(name)}`
      );
    }
    declared.set(name, MODULES[i]);
  }
});

const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).trim();
const markup = body.replace(/<script[\s\S]*?<\/script>\s*/g, '');

const page = `<title>Trigon</title>
<style>
${read('fonts.css').trim()}
${read('styles.css').trim()}
</style>

${markup}

<script type="module">
${stripped.join('\n')}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`wrote ${out} — ${(page.length / 1024).toFixed(0)} KB, ${declared.size} top-level names`);
