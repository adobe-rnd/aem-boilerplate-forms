import { expect, test } from '../../fixtures.js';
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';

// eslint-disable-next-line new-cap
const universalEditorBase = new UniversalEditorBase();
const textInputValue = 'Adobe';
const emailId = 'adobe@test.com';
const componentNames = ['textinput', 'emailinput', 'button'];
test.describe('Preview Validation in UE', async () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/aem-boilerplate-forms-xwalk-collaterals/ruleValidationInPreview.html';

  test('Rules validation in UE preview mode @chromium-only', async ({ page }) => {
    await page.goto(testURL);
    const frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    const iframeEditor = frame.frameLocator(universalEditorBase.selectors.iFrameEditor);
    const componentPathInUE = await iframeEditor.locator(`${universalEditorBase.selectors.componentPath + componentNames[2]}"]`);
    // eslint-disable-next-line max-len
    await expect(frame.locator(universalEditorBase.selectors.propertyPagePath)).toBeVisible();
    await expect(componentPathInUE).toBeVisible({ timeout: 16000 });
    const previewButton = frame.locator(universalEditorBase.selectors.preview);
    await expect(previewButton).toBeVisible();
    await previewButton.click();
    await expect(frame.locator(universalEditorBase.selectors.iFrameInPreview)).toBeVisible();
    const iframe = frame.frameLocator(universalEditorBase.selectors.iFrameInPreview);
    // eslint-disable-next-line no-restricted-syntax
    for (const componentName of componentNames) {
      // eslint-disable-next-line no-use-before-define
      const componentLocator = universalEditorBase.componentLocatorForPreview(componentName);
      if (componentName === 'button') {
        // eslint-disable-next-line no-await-in-loop
        await expect(iframe.locator(componentLocator)).toBeHidden();
      } else {
        // eslint-disable-next-line no-await-in-loop
        await expect(iframe.locator(componentLocator)).toBeVisible();
      }
    }
    // eslint-disable-next-line no-use-before-define,max-len
    const textInput = iframe.locator(universalEditorBase.componentLocatorForPreview(componentNames[0])).locator('input');
    // eslint-disable-next-line max-len
    const button = iframe.locator(universalEditorBase.componentLocatorForPreview(componentNames[2]));
    // eslint-disable-next-line no-use-before-define,max-len
    const emailInput = iframe.locator(universalEditorBase.componentLocatorForPreview(componentNames[1]));
    await textInput.fill(textInputValue);
    await textInput.blur();
    await expect(button).toBeVisible();
    await button.locator('button').click();
    expect(await emailInput.locator('input').inputValue()).toBe(emailId);
  });
});
