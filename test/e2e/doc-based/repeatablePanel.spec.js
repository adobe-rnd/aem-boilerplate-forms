import { test } from '../fixtures.js';
import {openPage, testRepeatablePanel} from '../utils.js';

const panelLocator = 'fieldset[class*="panel-wrapper field-panel-1 field-wrapper"]';
test.describe('Repeatability test in Doc-based forms', () => {
  const testURL = '/repeatablepanel';

  test('test the behaviour of correctly add and remove repeatable panel in Doc-based forms', async ({ page }) => {
    await openPage(page, testURL, 'docbased');
    await testRepeatablePanel(page, panelLocator);
  });
});