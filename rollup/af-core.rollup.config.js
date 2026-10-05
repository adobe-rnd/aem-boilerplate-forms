import path from 'path';
import { terser } from 'rollup-plugin-terser';
import {plugins} from './common.js';

const packageName = '@aemforms/af-core'
const directory = `node_modules/${packageName}`;
const eventEntry = path.join(directory, 'esm/afb-events.js');
const manualChunks = { events: [eventEntry] };

export default {
  external: ['@adobe/json-formula', '@aemforms/af-formatters'],
  preserveEntrySignatures: 'allow-extension',
  input: {
    runtime: path.join(directory, 'esm/afb-runtime.js'),
    events: eventEntry,
  },
  plugins: plugins(packageName),
  output: [{
    dir: 'blocks/form/rules/model',
    format: 'es',
    entryFileNames: 'afb-[name].js',
    manualChunks,
    paths: {
      '@adobe/json-formula': '../formula/index.js',
      '@aemforms/af-formatters': './afb-formatters.js',
    },
  },
  {
    dir: 'blocks/form/rules/model',
    format: 'es',
    entryFileNames: 'afb-[name].min.js',
    manualChunks,
    paths: {
      '@adobe/json-formula': '../formula/index.min.js',
      '@aemforms/af-formatters': './afb-formatters.min.js',
    },
    plugins: [terser()],
  }],
};
