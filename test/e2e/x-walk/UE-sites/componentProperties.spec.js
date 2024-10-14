import { expect, test } from '../../fixtures.js';
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';

// eslint-disable-next-line new-cap
const universalEditorBase = new UniversalEditorBase();
const componentName = 'Email Input';
const component = 'emailinput';
const now = new Date();
const randomValues = now.getTime();
test.describe('Component properties validation in UE', async () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/componentsPropertyTestCollateral/index.html';
  test('Component title validation in UE @chromium-only', async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });
    const frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    const componentPathInUE = await frame.locator(`${universalEditorBase.selectors.componentPath + component}"]`);
    const componentTitlePathInUE = componentPathInUE.filter('div[class="label"]');
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.propertyPagePath)).toBeVisible();
    await expect(componentPathInUE).toBeVisible({ timeout: 16000 });
    await componentPathInUE.click();
    const componentProperties = await frame.locator(universalEditorBase.selectors.panelHeaders);
    await expect(componentProperties).toBeVisible();
    await expect(componentProperties).toContainText(componentName);
    const titleLocator = frame.locator(universalEditorBase.selectors.componentTitleInProperties);
    // eslint-disable-next-line no-shadow
    const componentTitle = `${componentName}-${randomValues}`;
    await titleLocator.fill(componentTitle);
    await titleLocator.blur();
    await expect(componentTitlePathInUE).toHaveText(componentTitle, { timeout: 5000 });
  });
});
