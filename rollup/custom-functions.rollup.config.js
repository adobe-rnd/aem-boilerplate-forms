/**
 * Rollup config for customer custom functions — eager/lazy split.
 *
 * Invoked by scripts/build-custom-functions.js via:
 *   FUNCTIONS_SOURCE=<path-to-source.js> rollup -c rollup/custom-functions.rollup.config.js
 *
 * FUNCTIONS_SOURCE must be a .source.js file relative to the repo root,
 * e.g. blocks/form/mydir/myfn.source.js
 *
 * Reads split classification from blocks/form/functions-registry.json
 * (keyed by the entry point path, e.g. "blocks/form/mydir/myfn.js").
 * If no registry entry exists, falls back to a single minified bundle.
 *
 * Outputs (all in same directory as FUNCTIONS_SOURCE):
 *   Without --form (single bundle):
 *     {name}-bundle.js      — full bundle (readable)
 *     {name}-bundle.min.js  — full bundle (minified, what the shim exports from)
 *   With --form (eager/lazy split):
 *     {name}-bundle-eager.js      — eager bundle (readable)
 *     {name}-bundle-eager.min.js  — eager bundle (minified, what the shim exports from)
 *     {name}-bundle-lazy.js       — lazy bundle  (readable)
 *     {name}-bundle-lazy.min.js   — lazy bundle  (minified, loaded at 3s mark)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cleanup from 'rollup-plugin-cleanup';
import { terser } from 'rollup-plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Derive paths from FUNCTIONS_SOURCE
// ---------------------------------------------------------------------------
const SOURCE = process.env.FUNCTIONS_SOURCE;
if (!SOURCE) {
  console.error('[custom-functions] FUNCTIONS_SOURCE env var is required.');
  console.error('  Use scripts/build-custom-functions.js to invoke this config.');
  process.exit(1);
}

const SOURCE_ABS = path.resolve(ROOT, SOURCE);
const SOURCE_DIR = path.dirname(SOURCE);
const SOURCE_DIR_ABS = path.resolve(ROOT, SOURCE_DIR);
const SOURCE_NAME = path.basename(SOURCE, '.source.js');  // e.g. 'myfn'

// The shim file: {name}.js → export * from './{name}-eager.min.js'
// This is external to the eager build (breaks the self-import cycle).
const SHIM_JS_ABS = path.join(SOURCE_DIR_ABS, `${SOURCE_NAME}.js`);

// OOTB functions.js lives one directory above the source dir (blocks/form/functions.js).
// Keep it external — it is already loaded via modulepreload and must never be bundled in.
const OOTB_FN_JS_ABS = path.resolve(SOURCE_DIR_ABS, '../functions.js');

// ---------------------------------------------------------------------------
// Read split manifest from repo-level registry
// ---------------------------------------------------------------------------
const REGISTRY_PATH = path.join(ROOT, 'blocks/form/functions-registry.json');
const REGISTRY_KEY = SOURCE.replace(/\.source\.js$/, '.js').replace(/\\/g, '/');

let manifest = { eager: [], lazy: [], dead: [] };
let hasSplit = false;

if (fs.existsSync(REGISTRY_PATH)) {
  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const entry = registry[REGISTRY_KEY];
    if (entry && (entry.eager?.length || entry.lazy?.length)) {
      manifest = entry;
      hasSplit = true;
      console.log(`[custom-functions] Split manifest loaded for "${REGISTRY_KEY}":`
        + ` ${manifest.eager.length} eager, ${manifest.lazy.length} lazy`);
    } else {
      console.warn(`[custom-functions] No split entry found for "${REGISTRY_KEY}" — building single bundle.`);
    }
  } catch (e) {
    console.warn(`[custom-functions] Could not parse functions-registry.json: ${e.message} — building single bundle.`);
  }
} else {
  console.warn('[custom-functions] blocks/form/functions-registry.json not found — building single bundle.');
  console.warn('  Run: node scripts/build-custom-functions.js --functions <path> --form <url-or-path>');
}

// ---------------------------------------------------------------------------
// External predicates
// ---------------------------------------------------------------------------

// Any file named functions.js or functions.min.js is already loaded via
// modulepreload — keep it external so it is never bundled in.
const isFunctionsBundle = (id) => {
  const base = path.basename(id);
  return base === 'functions.js' || base === 'functions.min.js';
};

// Shared: always external (never bundled in)
const external = (id) => id.includes('afb-runtime')
  || id.includes('scripts/aem.js')
  || isFunctionsBundle(id);

// Eager build also marks the shim external — otherwise rollup follows
// {name}.js → {name}-eager.min.js → itself, creating an unbounded cycle.
const externalForEager = (id) => external(id)
  || (path.isAbsolute(id) && id === SHIM_JS_ABS)
  || (!path.isAbsolute(id) && path.resolve(path.dirname(SOURCE_ABS), id) === SHIM_JS_ABS);

// ---------------------------------------------------------------------------
// Remap plugin — within SOURCE_DIR, any import of {name}.js (the shim) is
// a self-reference (e.g. a helper module importing the bundle being built).
// Remap it to {name}.source.js so rollup bundles the real source code.
// ---------------------------------------------------------------------------
function remapSelfImportPlugin() {
  return {
    name: 'remap-self-import',
    resolveId(id, importer) {
      if (!importer) return null;
      const resolved = path.resolve(path.dirname(importer), id);
      if (
        resolved === SHIM_JS_ABS
        && importer.startsWith(SOURCE_DIR_ABS)
      ) {
        return SOURCE_ABS;
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Virtual eager entry plugin
//
// Generates the eager bundle entry on the fly:
//   1. Re-exports the real implementations for EAGER functions from source
//      (tree-shaken inline — only needed code is included).
//   2. Static re-exports of OOTB-only eager functions (external, no download).
//   3. Async/sync stubs for every LAZY function that load the lazy bundle
//      on first call via a single shared dynamic import.
//   4. Exports loadLazyBundle() so scripts.js can warm the bundle at 3s mark.
// ---------------------------------------------------------------------------
const EAGER_VIRTUAL_ID = '\0virtual:custom-functions-eager-entry';
const EAGER_SOURCE_SENTINEL = '\0virtual:custom-functions-source-reexport';
const EAGER_OOTB_SENTINEL = '\0virtual:custom-functions-ootb-reexport';

function eagerEntryPlugin(eagerFns, lazyFns) {
  const srcCode = fs.readFileSync(SOURCE_ABS, 'utf8');
  const ootbCode = fs.existsSync(OOTB_FN_JS_ABS)
    ? fs.readFileSync(OOTB_FN_JS_ABS, 'utf8')
    : '';

  function isExportedFrom(code, fn) {
    return new RegExp(`\\bexport\\b[^;]*\\b${fn}\\b`).test(code)
      || new RegExp(`export\\s*\\{[^}]*\\b${fn}\\b`).test(code);
  }

  function isAsyncFn(code, fn) {
    return new RegExp(`export\\s+async\\s+function\\s+${fn}\\b`).test(code)
      || new RegExp(`export\\s+const\\s+${fn}\\s*=\\s*async\\s*[({]`).test(code);
  }

  const JS_RESERVED = new Set([
    'null', 'undefined', 'true', 'false', 'void', 'typeof', 'instanceof', 'delete',
    'new', 'return', 'throw', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'break', 'continue', 'class', 'extends', 'super', 'import', 'export', 'default',
    'function', 'var', 'let', 'const', 'async', 'await', 'yield', 'in', 'of', 'with',
    'try', 'catch', 'finally', 'debugger', 'enum', 'implements', 'interface',
    'package', 'private', 'protected', 'public', 'static',
    'number', 'string', 'boolean', 'symbol', 'object', 'bigint', 'NaN', 'Infinity',
    'arguments', 'eval',
  ]);

  function isValidExportName(fn) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(fn) && !JS_RESERVED.has(fn);
  }

  const sourceOnlyEager = eagerFns.filter(
    (fn) => isValidExportName(fn) && isExportedFrom(srcCode, fn),
  );
  const ootbEager = eagerFns.filter(
    (fn) => isValidExportName(fn)
      && isExportedFrom(ootbCode, fn)
      && !isExportedFrom(srcCode, fn),
  );
  const stubTargets = lazyFns.filter(isValidExportName);

  return {
    name: 'custom-functions-eager-entry',
    resolveId(id) {
      if (id === EAGER_VIRTUAL_ID) return id;
      if (id === `./${SOURCE_NAME}-bundle-lazy.min.js`) return { id, external: true };
      if (id === EAGER_OOTB_SENTINEL) return { id: OOTB_FN_JS_ABS, external: true };
      if (id === EAGER_SOURCE_SENTINEL) return SOURCE_ABS;
      return null;
    },
    load(id) {
      if (id !== EAGER_VIRTUAL_ID) return null;

      const lines = [
        '// AUTO-GENERATED — do not edit.',
        '// Regenerate: node scripts/build-custom-functions.js --functions <entry> [--form <url-or-path>]',
        `// OOTB-EAGER   (${ootbEager.length}): static re-exports from ../functions.js`,
        `// SOURCE-EAGER (${sourceOnlyEager.length}): inlined from ${SOURCE_NAME}.source.js via tree-shaking`,
        `// STUBS        (${stubTargets.length}): async/sync stubs — lazy bundle loads on first call`,
        '',
      ];

      if (ootbEager.length > 0) {
        lines.push(`export { ${ootbEager.join(', ')} } from '${EAGER_OOTB_SENTINEL}';`);
      }
      if (sourceOnlyEager.length > 0) {
        lines.push(`export { ${sourceOnlyEager.join(', ')} } from '${EAGER_SOURCE_SENTINEL}';`);
      }

      if (stubTargets.length > 0) {
        lines.push('');
        lines.push('let _lazyBundle = null;');
        lines.push('async function _loadLazy() {');
        lines.push(`  if (!_lazyBundle) _lazyBundle = await import('./${SOURCE_NAME}-bundle-lazy.min.js');`);
        lines.push('  return _lazyBundle;');
        lines.push('}');
        lines.push('// Exported so scripts.js can warm the bundle at the 3s mark via window.hlx.loadLazyBundle');
        lines.push('export function loadLazyBundle() { return _loadLazy(); }');
        lines.push('');

        for (const fn of stubTargets) {
          if (isAsyncFn(srcCode, fn)) {
            lines.push(`export async function ${fn}(...args) {`);
            lines.push(`  return (await _loadLazy()).${fn}?.(...args);`);
            lines.push('}');
          } else {
            // Sync stub: never returns a Promise — avoids [object Promise] in field values
            lines.push(`export function ${fn}(...args) {`);
            lines.push(`  if (_lazyBundle) return _lazyBundle.${fn}?.(...args);`);
            lines.push('  _loadLazy();');
            lines.push(`  console.warn('[forms] "${fn}" called before lazy bundle loaded — add @MANUAL_EAGER if needed');`);
            lines.push('  return undefined;');
            lines.push('}');
          }
        }
      }

      return lines.join('\n');
    },
  };
}

// ---------------------------------------------------------------------------
// Build output path helpers
// ---------------------------------------------------------------------------
const isDev = process.env.MODE === 'dev';
const eagerPaths = {
  [OOTB_FN_JS_ABS]: isDev ? '../functions.js' : '../functions.min.js',
  [SHIM_JS_ABS]: `./${SOURCE_NAME}.js`,
};

// ---------------------------------------------------------------------------
// Dead-code functions — kept in lazy bundle (not removed) for safety.
// Deduplicate in case an older registry has dead already merged into lazy.
// ---------------------------------------------------------------------------
const allLazy = [...new Set([...(manifest.lazy || []), ...(manifest.dead || [])])];

// ---------------------------------------------------------------------------
// Rollup configs
// ---------------------------------------------------------------------------
const configs = [];

if (hasSplit) {
  // LAZY BUNDLE — full source (every function, real implementations)
  configs.push({
    input: SOURCE,
    external,
    plugins: [remapSelfImportPlugin(), cleanup({ comments: 'none' })],
    output: [
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle-lazy.js`,
        format: 'es',
        inlineDynamicImports: true,
        sourcemap: isDev,
      },
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle-lazy.min.js`,
        format: 'es',
        inlineDynamicImports: true,
        plugins: [terser()],
      },
    ],
  });

  // EAGER BUNDLE — virtual entry: inlined source-eager + OOTB re-exports + stubs
  configs.push({
    input: EAGER_VIRTUAL_ID,
    external: externalForEager,
    plugins: [
      eagerEntryPlugin(manifest.eager, allLazy),
      cleanup({ comments: 'none' }),
    ],
    output: [
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle-eager.js`,
        format: 'es',
        sourcemap: isDev,
        paths: eagerPaths,
      },
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle-eager.min.js`,
        format: 'es',
        plugins: [terser()],
        paths: eagerPaths,
      },
    ],
  });
} else {
  // SINGLE BUNDLE fallback (no split manifest / first run without --form)
  configs.push({
    input: SOURCE,
    external,
    plugins: [remapSelfImportPlugin(), cleanup({ comments: 'none' })],
    output: [
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle.js`,
        format: 'es',
        inlineDynamicImports: true,
        sourcemap: isDev,
      },
      {
        file: `${SOURCE_DIR}/${SOURCE_NAME}-bundle.min.js`,
        format: 'es',
        inlineDynamicImports: true,
        plugins: [terser()],
      },
    ],
  });
}

export default configs;
