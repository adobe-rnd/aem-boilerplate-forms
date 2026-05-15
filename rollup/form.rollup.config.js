import cleanup from 'rollup-plugin-cleanup';
import { terser } from 'rollup-plugin-terser';
import path from 'path';

// Redirect any import of rules/index.js to rules/index.source.js during the build.
// Components like repeat.js import subscribe from rules/index.js, but at build time
// rules/index.js is the runtime shim (re-exports from form-bundle.min.js). We redirect
// to index.source.js so Rollup bundles the real implementation without a circular ref.
const redirectRulesIndex = {
  name: 'redirect-rules-index',
  resolveId(id, importer) {
    if (id.endsWith('rules/index.js') && importer) {
      const dir = path.dirname(path.resolve(importer));
      return path.resolve(dir, id.replace('rules/index.js', 'rules/index.source.js'));
    }
    return null;
  },
};

// Dev-mode: unminified bundle output should reference the readable afb-runtime.js.
// Since afb-runtime is external, its import path passes through from source
// (RuleEngineWorker.js, functionRegistration.js) verbatim — and those source
// files use '.min.js' (per AC#4). In dev mode we rewrite back to '.js' so the
// main-thread bundle points at readable, source-mapped runtime code.
const remapToDev = {
  name: 'remap-to-dev',
  renderChunk(code) {
    if (process.env.MODE !== 'dev') return code;
    return code.replace(/afb-runtime\.min\.js/g, 'afb-runtime.js');
  },
};

// Prod-mode: terser does not alter string literals inside import statements,
// so an explicit post-terser renderChunk pass guarantees the minified output
// always references afb-runtime.min.js even if source drifts.
const remapToMin = {
  name: 'remap-to-min',
  renderChunk(code) {
    return code.replace(/afb-runtime\.js/g, 'afb-runtime.min.js');
  },
};

const external = (id) => id.includes('scripts/aem.js')
  || id.includes('afb-runtime')
  || id.includes('RuleEngineWorker')
  || id.endsWith('constant.js');

export default {
  input: 'blocks/form/form.source.js',
  external,
  plugins: [redirectRulesIndex, cleanup({ comments: 'none' })],
  output: [
    {
      file: 'blocks/form/form-bundle.js',
      format: 'es',
      inlineDynamicImports: true,
      sourcemap: process.env.MODE === 'dev',
      plugins: [remapToDev],
    },
    {
      file: 'blocks/form/form-bundle.min.js',
      format: 'es',
      inlineDynamicImports: true,
      plugins: [remapToMin, terser()],
    },
  ],
};
