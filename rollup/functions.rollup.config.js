import cleanup from 'rollup-plugin-cleanup';
import { terser } from 'rollup-plugin-terser';

const external = (id) => id.includes('afb-runtime')
  || id.endsWith('constant.js');

const minOutput = (file) => ({ file, format: 'es', plugins: [terser()] });

export default [
  // blocks/form/rules/functions.js → rules/functions.min.js  (worker OOTB bundle)
  {
    input: 'blocks/form/rules/functions.js',
    external,
    plugins: [cleanup({ comments: 'none' })],
    output: [minOutput('blocks/form/rules/functions.min.js')],
  },
  // blocks/form/functions.js → blocks/form/functions.min.js  (re-exported by eager bundles via ../functions.min.js)
  {
    input: 'blocks/form/functions.js',
    external,
    plugins: [cleanup({ comments: 'none' })],
    output: [minOutput('blocks/form/functions.min.js')],
  },
];
