import { test, expect } from '../../fixtures.js';
import { openPage } from '../../utils.js';

const accordionSelector = '[class$="field-wrapper accordion"] legend';
const expectedEmailValue = 'test@adobe.com';

test.describe('Accordion Validation', () => {
  const testURL = '/content/aem-boilerplate-forms-xwalk-collaterals/accordion-component-validation';
  test('Accordion component rules validation', async ({ page }) => {
    await openPage(page, testURL);
    await expect(await page.locator(accordionSelector).first()).toHaveText('Accordion');
    await expect(page.getByText('Item 1')).toBeVisible();
    await expect(page.getByText('Item 2')).toBeVisible();

    const button = page.getByRole('button', { name: 'Button' });
    await expect(await button).toBeHidden();
    const textInput = await page.getByLabel('Text Input');
    await textInput.fill('xyz');
    await textInput.press('Tab');

    await expect(await button).toBeVisible();
    await button.click();
    await page.getByText('Item 2').click();
    await expect(page.getByText('Email Input')).toHaveValue(expectedEmailValue);
  });
});
