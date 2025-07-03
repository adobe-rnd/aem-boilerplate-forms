/* eslint-env mocha */
import { executeTestInFolder, testBasicMarkup } from './testUtils.js';

// Custom component test with custom components array
function testCustomComponent(filePath, bUrlMode = false) {
  testBasicMarkup(filePath, bUrlMode, ['range'], '../..');
}

// executeTestInFolder('./test/unit/fixtures/custom-components/', testCustomComponent);
