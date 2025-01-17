import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

test.describe('Subscribe function validation', () => {
  const emailInputValue = 'newValue';
  const textInputValue = 'subscribeTest';
  const testURL = '/content/aem-boilerplate-forms-xwalk-collaterals/subscribe-validation';
  test('Subscribe function validation on text input', async ({ page }) => {
    await openPage(page, testURL);
    await page.evaluate(async () => {
      /* eslint-disable import/no-absolute-path */
      // eslint-disable-next-line import/no-unresolved
      await import('/blocks/form/rules/index.js').then((module) => {
        // eslint-disable-next-line no-unused-vars
        module.subscribe(document.querySelector('.text-wrapper'), (field, model) => {
          window.document.querySelector('.email-wrapper input').value = 'newValue';
          window.document.querySelector('.checkbox-wrapper').firstElementChild.click();
        });
      });
    });
    await page.getByLabel('Text Input').fill(textInputValue);
    await page.getByLabel('Text Input').blur();
    expect(await page.getByLabel('Email Input').inputValue()).toBe(emailInputValue);
    expect(await page.getByRole('checkbox', { name: 'Item 1' }).isChecked()).toBe(true);
  });
});
