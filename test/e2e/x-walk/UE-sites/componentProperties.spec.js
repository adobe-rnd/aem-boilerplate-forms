import { expect, test } from '../../fixtures.js';
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';

const universalEditorBase = new UniversalEditorBase();
const { selectors } = universalEditorBase;
const componentName = 'Email Input';
const component = 'emailinput';
const randomValues = Date.now();

test.describe('Component properties validation in UE', () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/aem-boilerplate-forms-xwalk-collaterals/componentPropertyValidation.html';

  test('Component title validation in UE @chromium-only', async ({ page }) => {
    await page.goto(testURL, { waitUntil: 'load' });

    const frame = page.frameLocator(selectors.iFrame);
    const iframeEditor = frame.frameLocator(selectors.iFrameEditor);
    const componentPathInUE = iframeEditor.locator(`${selectors.componentPath}${component}"]`);
    const componentTitlePathInUE = componentPathInUE.filter('input');

    await expect(frame.locator(selectors.propertyPagePath)).toBeVisible();
    await expect(componentPathInUE).toBeVisible({ timeout: 16000 });
    await componentTitlePathInUE.scrollIntoViewIfNeeded();
    await componentTitlePathInUE.click({ force: true });

    // Validate component properties panel
    const componentProperties = await frame.locator(selectors.panelHeaders).first();
    await expect(componentProperties).toBeVisible();
    await expect(componentProperties).toContainText(componentName);

    // Ensure property field is visible, reload if not
    const isPropertyVisible = frame.locator('.is-canvas [class="is-field is-container"]').first();
    if (!await isPropertyVisible.isVisible({ timeout: 6000 })) {
      await page.reload();
      await expect(isPropertyVisible).toBeVisible({ timeout: 10000 });
    }

    // Fill and validate the component title
    const titleLocator = frame.locator(selectors.componentTitleInProperties);
    const componentTitle = `${componentName}-${randomValues}`;
    await titleLocator.fill(componentTitle);
    await titleLocator.blur();
    await expect(componentTitlePathInUE).toHaveText(componentTitle, { timeout: 5000 });
  });
});
