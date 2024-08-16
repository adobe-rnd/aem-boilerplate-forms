import { test, expect } from '../../fixtures.js';
// eslint-disable-next-line import/named
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';

// eslint-disable-next-line new-cap
const universalEditorBase = new UniversalEditorBase();
let frame;
let properties;
let componentPathInUE;
const componentName = 'Text Input';
const component = 'textinput';

test.describe('Forms Authoring in Universal Editor tests', () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/componentValidationInUE/index.html';
  // eslint-disable-next-line no-shadow
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    properties = frame.locator(universalEditorBase.selectors.propertyPagePath);
    componentPathInUE = frame.locator(universalEditorBase.componentLocatorForUe(component));
    await expect(properties).toBeVisible();
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.ruleEditor)).toBeVisible({ timeout: 16000 });
    await frame.locator(universalEditorBase.selectors.contentTreeLabel).click();
    expect(await frame.locator(universalEditorBase.selectors.panelHeaders).innerText()).toBe('Content tree');
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.adaptiveFormPathInUE).first()).toBeVisible({ timeout: 10000 });
    if (await componentPathInUE.first().isVisible({ timeout: 10000 })) {
      await universalEditorBase.verifyComponentDelete(page, frame, component);
    }
  });
  test('Adding a new component and checking the markup @chromium-only', async () => {
    await frame.locator(universalEditorBase.selectors.formPathInUeSites).click();
    await universalEditorBase.verifyComponentInsert(frame, componentName, component);
  });

  test.afterEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    await frame.locator(universalEditorBase.selectors.contentTreeLabel).click();
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.adaptiveFormPathInUE).first()).toBeVisible({ timeout: 10000 });
    await universalEditorBase.verifyComponentDelete(page, frame, component);
  });
});
