import { test, expect } from '../../fixtures.js';
// eslint-disable-next-line import/named
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';

// eslint-disable-next-line new-cap
const universalEditorBase = new UniversalEditorBase();
const componentName = 'Text Input';
const component = 'textinput';

test.describe('Forms Authoring in Universal Editor tests', () => {
  let frame;
  let properties;
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/componentValidation/index.html';
  // eslint-disable-next-line no-shadow
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    properties = frame.locator(universalEditorBase.selectors.propertyPagePath);
    await expect(properties).toBeVisible();
    await frame.locator(universalEditorBase.selectors.contentTreeLabel).click();
    expect(await frame.locator(universalEditorBase.selectors.panelHeaders).innerText()).toBe('Content tree');
    await frame.locator(universalEditorBase.selectors.mainInContentTree).first().click();
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.ruleEditor)).toBeVisible({ timeout: 15000 });
    const adaptiveForm = frame.locator(universalEditorBase.componentLocatorForUe(component));
    if (await adaptiveForm.isVisible()) {
      await universalEditorBase.verifyComponentDelete(frame, component);
    }
  });
  test('Adding a new component and checking the markup', async () => {
    await frame.locator(universalEditorBase.selectors.formPathInUeSites).click();
    await universalEditorBase.verifyComponentInsert(frame, componentName, component);
  });

  test.afterEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    await frame.locator(universalEditorBase.selectors.contentTreeLabel).click();
    const elementLocator = frame.locator(universalEditorBase.componentLocatorForUe(component));
    if (await elementLocator.isVisible()) {
      await universalEditorBase.verifyComponentDelete(frame, component);
    }
  });
});
