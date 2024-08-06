import { expect, test } from '../fixtures.js';
import { AddComponentsInUePage } from '../main/page/addComponentsInUePage.js';

// eslint-disable-next-line new-cap
const addComponentsInUe = new AddComponentsInUePage();
const componentName = 'Email Input';
const component = 'emailinput';
const now = new Date();
const randomValues = now.getTime();
test.describe('Component properties validation', async () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/venky2/index.html';
  test('Component title validation in UE', async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    const frame = page.frameLocator(addComponentsInUe.selectors.iFrame);
    // eslint-disable-next-line max-len
    await expect(frame.locator(addComponentsInUe.selectors.propertyPagePath)).toBeVisible({ timeout: 20000 });
    const componentPathInUE = await frame.locator(`${addComponentsInUe.selectors.componentPath + component}"]`);
    const componentTitlePathInUE = componentPathInUE.filter('div[class="label"]');
    // eslint-disable-next-line max-len
    await expect(frame.locator(addComponentsInUe.selectors.ruleEditor)).toBeVisible({ timeout: 15000 });
    await expect(componentPathInUE).toBeVisible({ timeout: 15000 });
    await componentPathInUE.click();
    const componentProperties = await frame.locator(addComponentsInUe.selectors.panelHeaders);
    await expect(componentProperties).toBeVisible();
    await expect(componentProperties).toContainText(componentName);
    const titleLocator = frame.locator(addComponentsInUe.selectors.componentTitleInProperties);
    // eslint-disable-next-line no-shadow
    const componentTitle = `${componentName}-${randomValues}`;
    await titleLocator.fill(componentTitle);
    await titleLocator.blur();
    await expect(componentTitlePathInUE).toHaveText(componentTitle, { timeout: 5000 });
  });
});
