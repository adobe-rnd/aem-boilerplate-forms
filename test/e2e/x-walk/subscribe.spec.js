import { test, expect } from '../fixtures.js';

test.describe('Subscribe function validation', () => {
  const emailInputValue = 'newValue';
  const textInputValue = 'subscribeTest';
  test('Subscribe function validation on text input', async ({ page }) => {
    // eslint-disable-next-line no-unused-expressions
    await page.goto('https://subscribe--aem-boilerplate-forms--adobe-rnd.hlx.live/drafts/tests/x-walk/subscribevalidation', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      /* eslint-disable import/no-absolute-path */
      // eslint-disable-next-line import/no-unresolved
      await import('/blocks/form/util.js').then((module) => {
        /* eslint-disable prefer-arrow-callback */
        // eslint-disable-next-line func-names
        // eslint-disable-next-line no-unused-vars
        module.subscribe(document.querySelector('.text-wrapper'), function (field, model) {
          // eslint-disable-next-line no-alert
          window.document.querySelector('.email-wrapper input').value = 'newValue';
          // eslint-disable-next-line no-unused-expressions
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
