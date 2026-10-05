import path from 'path';
import { terser } from 'rollup-plugin-terser';
import {plugins} from './common.js';

const packageName = '@aemforms/af-webmcp'
const directory = `node_modules/${packageName}`;

// af-webmcp is a thin browser adapter; its only runtime dependency is buildFormTools
// from af-core, which is already vendored next to it. Externalize af-core and remap the
// import to the sibling vendored bundle so we do not duplicate the model code.
export default {
  external: ['@aemforms/af-core'],
  input: {
    webmcp: path.join(directory, 'esm/index.js'),
  },
  plugins: plugins(packageName),
  output: [{
    dir: 'blocks/form/rules/model',
    format: 'es',
    entryFileNames: 'afb-[name].js',
    paths: {
      '@aemforms/af-core': './afb-runtime.js',
    },
  },
  {
    dir: 'blocks/form/rules/model',
    format: 'es',
    entryFileNames: 'afb-[name].min.js',
    paths: {
      '@aemforms/af-core': './afb-runtime.min.js',
    },
    plugins: [terser()],
  }],
};
