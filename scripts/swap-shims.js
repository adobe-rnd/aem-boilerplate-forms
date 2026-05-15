#!/usr/bin/env node
// swap-shims.js — rewrite shim re-exports to point at dev (.js) or prod (.min.js) bundles.
// Usage: node scripts/swap-shims.js --mode dev|prod
//
// Shim files are located by searching one level deep from the repo root so this
// script works across repos regardless of whether blocks live at `blocks/` or
// `eds-assets/blocks/` or any other prefix.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Match relative imports ('./x.js' or '../x.js') whose basename is a known
// minifiable lib. Group 1: quote; group 2: path prefix up to (but excluding)
// the name; group 3: minifiable name; group 4: optional `.min`.
// The prefix is required to start with ./ or ../ — template-literal paths
// (e.g. `${prefix}blocks/.../x.js`) are deliberately skipped since they can
// only be resolved at runtime, not statically.
const MINIFIABLE = /(['"])((?:\.{1,2}\/)[^'"]*?)\b([\w-]+-bundle|afb-runtime|afb-formatters|afb-events|functions)(\.min)?\.js\1/g;

// Fixed shim suffixes (stable paths, not journey-specific).
// Includes worker files that directly import .min.js runtime deps.
const FIXED_SHIM_SUFFIXES = [
  'blocks/form/form.js',
  'blocks/form/rules/index.js',
  'blocks/form/rules/RuleEngineWorker.js',
  'blocks/form/rules/functionRegistration.js',
];

// Scan all .js files inside any `components/` directory found anywhere under
// the repo root (skipping node_modules, .git, rollup, scripts).
// No prefix assumptions — works regardless of eds-assets/ or any other layout.
function findComponentFiles() {
  const SKIP = new Set(['.git', 'node_modules', 'rollup', 'scripts']);
  const files = [];

  function walk(dir, inComponents) {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry) || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const isDir = statSync(full).isDirectory();
      if (isDir) {
        walk(full, inComponents || entry === 'components');
      } else if (inComponents && entry.endsWith('.js')) {
        const content = readFileSync(full, 'utf8');
        MINIFIABLE.lastIndex = 0;
        if (MINIFIABLE.test(content)) {
          MINIFIABLE.lastIndex = 0;
          const rel = full.replace(`${root}/`, '').replace(/\\/g, '/');
          files.push({ abs: full, rel });
        }
        MINIFIABLE.lastIndex = 0;
      }
    }
  }

  walk(root, false);
  return files;
}

// Locate a file by its suffix: try repo root directly, then each top-level dir.
function findShim(suffix) {
  const direct = resolve(root, suffix);
  if (existsSync(direct)) return { abs: direct, rel: suffix };

  for (const entry of readdirSync(root)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const candidate = resolve(root, entry, suffix);
    if (existsSync(candidate)) return { abs: candidate, rel: `${entry}/${suffix}` };
  }
  return null;
}

// Find the blocks/form directory (may be prefixed, e.g. eds-assets/blocks/form).
function findBlocksFormDir() {
  const direct = resolve(root, 'blocks/form');
  if (existsSync(direct)) return { dir: direct, prefix: '' };

  for (const entry of readdirSync(root)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const candidate = resolve(root, entry, 'blocks/form');
    if (existsSync(candidate)) return { dir: candidate, prefix: `${entry}/` };
  }
  return null;
}

// Recursively find all functions.js shims under blocks/form/ that are at least
// one subdirectory deep — i.e. blocks/form/<journey>/functions.js.
// Excludes blocks/form/functions.js itself (the OOTB base, not a shim).
function findJourneyFunctionShims() {
  const found = findBlocksFormDir();
  if (!found) return [];

  const shims = [];

  function walk(dir, depth) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, depth + 1);
      } else if (entry === 'functions.js' && depth >= 1) {
        const rel = full.replace(`${root}/`, '').replace(/\\/g, '/');
        shims.push({ abs: full, rel });
      }
    }
  }

  walk(found.dir, 0);
  return shims;
}

const args = process.argv.slice(2);
const modeIdx = args.indexOf('--mode');
if (modeIdx === -1 || !args[modeIdx + 1]) {
  console.error('Usage: node scripts/swap-shims.js --mode dev|prod');
  process.exit(1);
}

const mode = args[modeIdx + 1];
if (mode !== 'dev' && mode !== 'prod') {
  console.error(`Unknown mode "${mode}". Expected "dev" or "prod".`);
  process.exit(1);
}

const allShims = [
  ...FIXED_SHIM_SUFFIXES.map(findShim).filter(Boolean),
  ...findJourneyFunctionShims(),
  ...findComponentFiles(),
];

for (const shim of allShims) {
  const original = readFileSync(shim.abs, 'utf8');
  const shimDir = dirname(shim.abs);

  MINIFIABLE.lastIndex = 0;
  let matched = false;
  const updated = original.replace(MINIFIABLE, (full, quote, prefix, name, minSuffix) => {
    matched = true;
    const hasMin = Boolean(minSuffix);
    const wantMin = mode === 'prod';

    // If already at the desired state, no-op.
    if (hasMin === wantMin) return full;

    // Compute the candidate target filename. For prod (.js → .min.js),
    // only flip if the resolved target exists on disk. For dev
    // (.min.js → .js), only flip if the resolved target exists on disk.
    // Guards against breaking imports where the counterpart file is absent.
    const targetRelPath = `${prefix}${name}${wantMin ? '.min' : ''}.js`;
    const targetAbsPath = resolve(shimDir, targetRelPath);
    if (!existsSync(targetAbsPath)) return full;

    return `${quote}${targetRelPath}${quote}`;
  });

  if (!matched) continue;

  if (updated !== original) {
    writeFileSync(shim.abs, updated, 'utf8');
    console.log(`[swap-shims] ${shim.rel} → ${mode}`);
  } else {
    console.log(`[swap-shims] ${shim.rel} already in ${mode} mode, no change`);
  }
}
