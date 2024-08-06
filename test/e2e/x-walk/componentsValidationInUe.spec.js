import { test, expect } from '../fixtures.js';
// eslint-disable-next-line import/named
import { AddComponentsInUePage } from '../main/page/addComponentsInUePage.js';

// eslint-disable-next-line new-cap
const addComponentsInUe = new AddComponentsInUePage();
const componentName = 'Text Input';
const component = 'textinput';

test.describe('todo tests', () => {
  let frame;
  let properties;
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/venky2/index.html';
  // eslint-disable-next-line no-shadow
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    frame = page.frameLocator(addComponentsInUe.selectors.iFrame);
    properties = frame.locator(addComponentsInUe.selectors.propertyPagePath);
    await expect(properties).toBeVisible();
    await frame.locator(addComponentsInUe.selectors.contentTreeLabel).click();
    expect(await frame.locator(addComponentsInUe.selectors.panelHeaders).innerText()).toBe('Content tree');
    await frame.locator(addComponentsInUe.selectors.mainInContentTree).first().click();
    // eslint-disable-next-line max-len
    await expect(frame.locator(addComponentsInUe.selectors.ruleEditor)).toBeVisible({ timeout: 15000 });
    const adaptiveForm = frame.locator(addComponentsInUe.componentLocatorForUe(component));
    if (await adaptiveForm.isVisible()) {
      await addComponentsInUe.componentDelete(frame, component);
    }
  });
  test('Adding a new component and checking the markup', async () => {
    await frame.locator(addComponentsInUe.selectors.formPathInUeSites).click();
    await addComponentsInUe.addingComponentsInUE(frame, componentName, component);
  });

  test.afterEach(async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    await frame.locator(addComponentsInUe.selectors.contentTreeLabel).click();
    const elementLocator = frame.locator(addComponentsInUe.componentLocatorForUe(component));
    if (await elementLocator.isVisible()) {
      await addComponentsInUe.componentDelete(frame, component);
    }
  });
});
