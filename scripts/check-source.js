#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const errors = [];
function check(file) { const r = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' }); if (r.status) errors.push(file + ': ' + (r.stderr || r.stdout).trim()); }
['main.js', 'preload.js', ...fs.readdirSync(path.join(root, 'src/main')).filter((f) => f.endsWith('.js')).map((f) => 'src/main/' + f), ...walk(path.join(root, 'src/renderer')).map((f) => path.relative(root, f))].forEach(check);
for (const page of ['index.html', 'day.html', 'summary.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const src of [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1])) if (!fs.existsSync(path.join(root, src))) errors.push(page + ': missing ' + src);
  const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);
  for (const href of css) if (!fs.existsSync(path.join(root, href))) errors.push(page + ': missing ' + href);
}
for (const config of ['package.json', 'builder-menu.json']) { try { JSON.parse(fs.readFileSync(path.join(root, config), 'utf8')); } catch (e) { errors.push(config + ': ' + e.message); } }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('source check passed');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const p = path.join(dir, entry.name); return entry.isDirectory() ? walk(p) : entry.name.endsWith('.js') ? [p] : []; }); }
