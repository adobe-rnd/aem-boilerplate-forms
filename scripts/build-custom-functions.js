#!/usr/bin/env node
/**
 * Builds an optimised custom functions bundle for any EDS form.
 *
 * Usage:
 *   # Minify-only (no eager/lazy split):
 *   node scripts/build-custom-functions.js --functions blocks/form/mydir/myfn.js
 *
 *   # Full eager/lazy split — --form accepts any of:
 *   #   • EDS page URL  (extracts form JSON from <pre><code> block)
 *   #   • .model.json or .json URL  (fetched and parsed directly)
 *   #   • local file path  (read from disk)
 *   node scripts/build-custom-functions.js \
 *     --functions blocks/form/mydir/myfn.js \
 *     --form https://your-site.aem.live/path/to/form-page
 *
 * What it does:
 *   1. On first run: backs up myfn.js → myfn.source.js (authoritative source).
 *      Subsequent runs use myfn.source.js automatically.
 *   2. Parses @MANUAL_EAGER / @MANUAL_LAZY JSDoc annotations from the source.
 *   3. If --form: walks the form JSON, classifies every exported function as
 *      LOAD_TIME (→ eager) or INTERACTION_ONLY (→ lazy), applies annotations.
 *   4. Updates blocks/form/functions-registry.json (keyed by entry point path).
 *   5. Runs rollup (rollup/custom-functions.rollup.config.js) to produce:
 *        myfn-bundle.min.js        — single bundle   (no --form)
 *        myfn-bundle-eager.min.js  — eager bundle     (with --form, real impls + stubs)
 *        myfn-bundle-lazy.min.js   — lazy bundle      (with --form, all real impls)
 *   6. Writes the shim:  myfn.js → `export * from './myfn-bundle[-eager].min.js';`
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const functionsArg = getArg('--functions');
const formArg = getArg('--form');

if (!functionsArg) {
  console.error([
    'Error: --functions is required.',
    '',
    'Usage:',
    '  node scripts/build-custom-functions.js --functions <path> [--form <url-or-path>]',
    '',
    'Examples:',
    '  node scripts/build-custom-functions.js --functions blocks/form/mydir/myfn.js',
    '  node scripts/build-custom-functions.js --functions blocks/form/mydir/myfn.js --form https://your-site.aem.live/path/to/form',
    '  node scripts/build-custom-functions.js --functions blocks/form/mydir/myfn.js --form https://your-site.aem.live/path/to/form.model.json',
    '  node scripts/build-custom-functions.js --functions blocks/form/mydir/myfn.js --form path/to/form.json',
  ].join('\n'));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Path derivation
// ---------------------------------------------------------------------------

// normalised: repo-relative, no leading slash (used as registry key)
const normalised = functionsArg.replace(/^\//, '').replace(/\\/g, '/');
const absEntry = path.resolve(ROOT, normalised);
const dir = path.dirname(absEntry);
const filename = path.basename(normalised);            // e.g. myfn.js
const name = filename.replace(/\.js$/, '');            // e.g. myfn
const sourceFile = path.join(dir, `${name}.source.js`);

// ---------------------------------------------------------------------------
// Step 1 — determine / create source file
// ---------------------------------------------------------------------------
let isFirstRun = false;
if (!fs.existsSync(sourceFile)) {
  if (!fs.existsSync(absEntry)) {
    console.error(`Not found: ${absEntry}`);
    process.exit(1);
  }
  // First run: back up the original file as the authoritative source
  fs.copyFileSync(absEntry, sourceFile);
  isFirstRun = true;
  console.log(`[build-custom-functions] First run — backed up ${filename} → ${name}.source.js`);
} else {
  console.log(`[build-custom-functions] Using existing source: ${name}.source.js`);
}

const sourceCode = fs.readFileSync(sourceFile, 'utf8');

// ---------------------------------------------------------------------------
// Step 2 — parse @MANUAL_EAGER / @MANUAL_LAZY inline annotations
// ---------------------------------------------------------------------------

function parseAnnotations(code) {
  const manualEager = new Set();
  const manualLazy = new Set();

  // Match JSDoc block + optional export + function name (block export at EOF is supported)
  const eagerFnRe = /\/\*\*[\s\S]*?@MANUAL_EAGER[\s\S]*?\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  const lazyFnRe = /\/\*\*[\s\S]*?@MANUAL_LAZY[\s\S]*?\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  const eagerConstRe = /\/\*\*[\s\S]*?@MANUAL_EAGER[\s\S]*?\*\/\s*export\s+(?:const|let)\s+(\w+)/g;
  const lazyConstRe = /\/\*\*[\s\S]*?@MANUAL_LAZY[\s\S]*?\*\/\s*export\s+(?:const|let)\s+(\w+)/g;

  let m;
  while ((m = eagerFnRe.exec(code)) !== null) manualEager.add(m[1]);
  while ((m = lazyFnRe.exec(code)) !== null) manualLazy.add(m[1]);
  while ((m = eagerConstRe.exec(code)) !== null) manualEager.add(m[1]);
  while ((m = lazyConstRe.exec(code)) !== null) manualLazy.add(m[1]);

  return { manualEager, manualLazy };
}

const { manualEager, manualLazy } = parseAnnotations(sourceCode);
if (manualEager.size || manualLazy.size) {
  console.log(`[build-custom-functions] Annotations: ${manualEager.size} @MANUAL_EAGER, ${manualLazy.size} @MANUAL_LAZY`);
}

// ---------------------------------------------------------------------------
// Step 3 — load form JSON (from --form: URL or local path)
// ---------------------------------------------------------------------------

async function loadFormJson() {
  if (!formArg) return null;
  if (/^https?:\/\//i.test(formArg)) {
    console.log(`[build-custom-functions] Fetching from: ${formArg}`);
    const res = await fetch(formArg);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${formArg}`);
    // .model.json or any .json URL → parse as JSON directly
    if (/\.json$/i.test(formArg.split('?')[0])) return res.json();
    // EDS page path → extract JSON from <pre><code> block
    const html = await res.text();
    const preMatch = html.match(/<pre[^>]*>(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?<\/pre>/i);
    if (!preMatch) throw new Error('No <pre> tag found — is this an EDS form page?');
    const raw = preMatch[1].trim();
    return raw.startsWith('"') ? JSON.parse(JSON.parse(raw)) : JSON.parse(raw);
  }
  // Local file path
  const p = path.resolve(process.cwd(), formArg);
  if (!fs.existsSync(p)) { console.error(`Not found: ${p}`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// Form JSON walker (same as POC analyze-functions.js)
// ---------------------------------------------------------------------------

function walkItems(node, visitor, isRoot = false) {
  if (!node || typeof node !== 'object') return;
  visitor(node, isRoot);
  if (Array.isArray(node.items)) {
    node.items.forEach((k) => walkItems(k, visitor, false));
    return;
  }
  const itemsMap = node[':items'];
  const itemsOrder = node[':itemsOrder'];
  if (itemsMap && typeof itemsMap === 'object') {
    const keys = Array.isArray(itemsOrder) ? itemsOrder : Object.keys(itemsMap);
    keys.forEach((k) => walkItems(itemsMap[k], visitor, false));
  }
}

function extractCalls(expr) {
  const RE = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  const found = [];
  const exprs = Array.isArray(expr) ? expr : [expr];
  for (const e of exprs) {
    if (typeof e !== 'string') continue;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(e)) !== null) found.push(m[1]);
  }
  return found;
}

const BUILTINS = new Set([
  'if', 'else', 'return', 'new', 'typeof', 'instanceof', 'delete', 'void', 'throw',
  'async', 'await', 'function', 'class', 'extends', 'super', 'import', 'export',
  'console', 'window', 'document', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Math', 'Date', 'Promise', 'Set', 'Map', 'Error', 'RegExp', 'Symbol',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'encodeURIComponent',
  'decodeURI', 'decodeURIComponent', 'fetch', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'queueMicrotask',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'validate', 'empty', 'exists',
  'contains', 'count', 'sum', 'avg', 'min', 'max', 'not', 'length', 'indexOf',
  'substr', 'trim', 'lower', 'upper', 'startsWith', 'endsWith', 'replace', 'split',
  'join', 'round', 'floor', 'ceil', 'abs', 'pow', 'sqrt', 'log',
  'toDate', 'toString', 'toNumber', 'toBoolean',
  'number', 'string', 'boolean', 'object', 'name', 'Name',
  'dateGt', 'dateLt', 'dateGe', 'dateLe', 'dateEq',
  'enumToLabel', 'labelToEnum',
  '_', '$', 'e', 'n', 't', 'r', 's',
  'dispatchEvent', 'awaitFn', 'requestWithRetry',
  'navigateTo', 'toObject', 'exportFormData', 'getBrowserDetail', 'getURLDetail',
  'validateURL', 'defaultErrorHandler', 'defaultSubmitSuccessHandler',
  'defaultSubmitErrorHandler', 'fetchCaptchaToken', 'dateToDaysSinceEpoch',
]);

const LOAD_TIME_EVENTS = new Set(['initialize', 'custom:formViewInitialized']);
const ROOT_LOAD_TIME_PREFIXES = ['custom:wsdlSuccess_', 'custom:decryptSuccess_'];

function classifyFunctions(formJson, annotations) {
  const loadTimeFns = new Set([...annotations.manualEager]);
  const interactionFns = new Set([...annotations.manualLazy]);

  walkItems(formJson, (node, isRoot) => {
    for (const expr of Object.values(node.rules || {})) {
      extractCalls(expr).forEach((fn) => { if (!BUILTINS.has(fn)) loadTimeFns.add(fn); });
    }
    for (const [evt, expr] of Object.entries(node.events || {})) {
      const fns = extractCalls(expr).filter((fn) => !BUILTINS.has(fn));
      const isLoadTime = LOAD_TIME_EVENTS.has(evt)
        || (isRoot && ROOT_LOAD_TIME_PREFIXES.some((p) => evt.startsWith(p)));
      fns.forEach((fn) => { if (isLoadTime) loadTimeFns.add(fn); else interactionFns.add(fn); });
    }
  }, true);

  // Annotation overrides: MANUAL_EAGER wins over static analysis
  for (const fn of annotations.manualEager) { loadTimeFns.add(fn); interactionFns.delete(fn); }
  // MANUAL_LAZY: move out of eager even if static analysis placed it there
  for (const fn of annotations.manualLazy) { loadTimeFns.delete(fn); interactionFns.add(fn); }

  // Conservative: if a fn appears in both, keep in load-time
  for (const fn of loadTimeFns) interactionFns.delete(fn);

  // Collect all exported function names from source
  const exportedNames = new Set();
  const namedRe = /export\s+(?:async\s+)?(?:function\*?|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  const blockRe = /export\s*\{([^}]+)\}/g;
  let m;
  while ((m = namedRe.exec(sourceCode)) !== null) exportedNames.add(m[1]);
  while ((m = blockRe.exec(sourceCode)) !== null) {
    const identRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:as\s+[a-zA-Z_$][a-zA-Z0-9_$]*)?\s*[,}]/g;
    let im;
    while ((im = identRe.exec(m[1])) !== null) exportedNames.add(im[1]);
  }

  // Determine dead code vs internal helpers
  const notInJson = [...exportedNames].filter((fn) => !loadTimeFns.has(fn) && !interactionFns.has(fn));
  const dead = [];
  const internalHelpers = [];

  for (const fn of notInJson) {
    const callRE = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    const occurrences = (sourceCode.match(callRE) || []).length;
    if (occurrences >= 2) {
      internalHelpers.push(fn); // called internally — keep (classify via caller)
    } else {
      dead.push(fn);
    }
  }

  const eager = [...new Set([...loadTimeFns, ...internalHelpers])].sort();
  const lazy = [...new Set([...interactionFns])].sort();

  return { eager, lazy, dead: dead.sort() };
}

// ---------------------------------------------------------------------------
// Step 4/5 — classify (if form JSON available) and update registry
// ---------------------------------------------------------------------------

const REGISTRY_PATH = path.join(ROOT, 'blocks/form/functions-registry.json');

async function run() {
  const formJson = await loadFormJson();

  let split = null;
  if (formJson) {
    console.log('[build-custom-functions] Classifying functions from form JSON…');
    split = classifyFunctions(formJson, { manualEager, manualLazy });
    console.log(`  EAGER: ${split.eager.length} fns  |  LAZY: ${split.lazy.length} fns  |  DEAD: ${split.dead.length} fns`);

    // Update registry (keyed by normalised entry point path)
    let registry = {};
    if (fs.existsSync(REGISTRY_PATH)) {
      try { registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { /* start fresh */ }
    }
    registry[normalised] = {
      generated: new Date().toISOString(),
      ...(formArg ? { form: formArg } : {}),
      eager: split.eager,
      lazy: split.lazy,
      dead: split.dead,
    };
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
    console.log(`[build-custom-functions] Registry updated: blocks/form/functions-registry.json`);
  } else {
    // Check whether a previous --form run left split data in the registry.
    // If so, rollup will still build the split bundles (it reads the registry independently).
    let registryHasSplit = false;
    if (fs.existsSync(REGISTRY_PATH)) {
      try {
        const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        const entry = reg[normalised];
        registryHasSplit = !!(entry && (entry.eager?.length || entry.lazy?.length));
      } catch { /* ignore */ }
    }
    if (registryHasSplit) {
      console.log('[build-custom-functions] No form JSON — reusing existing split from registry.');
    } else {
      console.log('[build-custom-functions] No form JSON — building single merged bundle (no eager/lazy split).');
      console.log('  Tip: pass --form <url-or-path> to enable the eager/lazy split.');
    }
    // Promote to a truthy marker so shim logic below picks the right target
    if (registryHasSplit) split = registryHasSplit;
  }

  // ---------------------------------------------------------------------------
  // Step 6 — run rollup
  // ---------------------------------------------------------------------------
  const rollupConfig = path.join(ROOT, 'rollup/custom-functions.rollup.config.js');
  if (!fs.existsSync(rollupConfig)) {
    console.error(`Rollup config not found: ${rollupConfig}`);
    process.exit(1);
  }

  const env = {
    ...process.env,
    FUNCTIONS_SOURCE: path.relative(ROOT, sourceFile),
  };

  console.log('[build-custom-functions] Running rollup…');
  execSync(`node_modules/.bin/rollup -c rollup/custom-functions.rollup.config.js`, {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });

  // ---------------------------------------------------------------------------
  // Step 7 — write shim
  // ---------------------------------------------------------------------------
  const shimTarget = split ? `${name}-bundle-eager.min.js` : `${name}-bundle.min.js`;
  const shimContent = `export * from './${shimTarget}';\n`;
  fs.writeFileSync(absEntry, shimContent, 'utf8');
  console.log(`[build-custom-functions] Shim written: ${filename} → export * from './${shimTarget}'`);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const HR = '─'.repeat(60);
  console.log(`\n${HR}`);
  console.log('  BUILD COMPLETE');
  console.log(HR);
  console.log(`  Entry:  ${normalised}  (shim)`);
  console.log(`  Source: ${path.relative(ROOT, sourceFile)}`);
  if (split && typeof split === 'object') {
    const relDir = path.relative(ROOT, dir);
    console.log(`  Eager:  ${relDir}/${name}-bundle-eager.min.js   (${split.eager.length} fns)`);
    console.log(`  Lazy:   ${relDir}/${name}-bundle-lazy.min.js    (${split.lazy.length + split.dead.length} fns, loads at 3s mark)`);
    const totalFns = split.eager.length + split.lazy.length + split.dead.length;
    if (totalFns > 0) {
      const savePct = Math.round(((split.lazy.length + split.dead.length) / totalFns) * 100);
      console.log(`  Saving: ~${savePct}% of custom-function JS off the critical path`);
    }
  } else if (split) {
    const relDir = path.relative(ROOT, dir);
    console.log(`  Eager:  ${relDir}/${name}-bundle-eager.min.js`);
    console.log(`  Lazy:   ${relDir}/${name}-bundle-lazy.min.js   (loads at 3s mark)`);
  } else {
    console.log(`  Bundle: ${path.relative(ROOT, dir)}/${name}-bundle.min.js   (single bundle)`);
  }
  if (isFirstRun) {
    console.log(`\n  NOTE: edit ${name}.source.js from now on, then re-run this command.`);
  }
  console.log(`${HR}\n`);
}

run().catch((err) => {
  console.error(`\n[build-custom-functions] Error: ${err.message}`);
  process.exit(1);
});
