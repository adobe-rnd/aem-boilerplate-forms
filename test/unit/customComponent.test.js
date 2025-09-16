import path from 'path';
import { testBasicMarkup } from './testUtils.js';

window.hlx = { codeBasePath: '' };
testBasicMarkup(path.resolve('./test/unit/fixtures/custom-component/range.js'), false, ['range'], '../../test/unit/fixtures');
