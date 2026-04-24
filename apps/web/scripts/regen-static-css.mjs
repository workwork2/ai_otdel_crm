#!/usr/bin/env node
/**
 * Пересобирает статические утилитарные стили из tw-build.css (без tailwind в runtime).
 *   node scripts/regen-static-css.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const input = path.join(root, 'src', 'styles', 'tw-build.css');
const output = path.join(root, 'src', 'styles', 'static-utilities.css');

const r = spawnSync(
  'npx',
  ['--yes', '@tailwindcss/cli@4', 'build', '-i', input, '-o', output, '-m'],
  { cwd: root, stdio: 'inherit', shell: true },
);
process.exit(r.status ?? 1);
