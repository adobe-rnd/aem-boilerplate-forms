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

test.describe.skip('Forms Authoring in Universal Editor tests', () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/componentValidationTestCollateral/index.html';
  // eslint-disable-next-line no-shadow
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    properties = frame.locator(universalEditorBase.selectors.propertyPagePath);
    componentPathInUE = frame.locator(universalEditorBase.componentLocatorForUe(component));
    // eslint-disable-next-line max-len
    const adaptiveFormPathInUE = frame.locator(universalEditorBase.selectors.adaptiveFormPathInUE).first();
    const ruleEditor = frame.locator(universalEditorBase.selectors.ruleEditor);
    await expect(properties).toBeVisible();
    try {
      await expect(adaptiveFormPathInUE).toBeVisible({ timeout: 16000 });
    } catch (error) {
      await expect(ruleEditor).toBeVisible({ timeout: 10000 });
      await expect(adaptiveFormPathInUE).toBeVisible();
    }
    await frame.locator(universalEditorBase.selectors.contentTreeLabel).click();
    await expect(frame.locator(universalEditorBase.selectors.panelHeaders)).toHaveText('Content tree');
    if (await componentPathInUE.first().isVisible({ timeout: 10000 })) {
      await universalEditorBase.verifyComponentDelete(page, frame, component);
    }
  });
  test('Adding a new component and checking the markup @chromium-only', async () => {
    await frame.locator(universalEditorBase.selectors.formPathInUeSites).scrollIntoViewIfNeeded();
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
