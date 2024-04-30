import { test, expect } from '@playwright/test';
import { getCurrentBranch } from '../utils.js';

test('Test formatting using custom functions', async ({ page }) => {
  await page.goto(`https://${getCurrentBranch()}--aem-boilerplate-forms--adobe-rnd.hlx.live/drafts/tests/x-walk/formatting-using-customfunctions`, { waitUntil: 'networkidle' });
  const telephoneInput = await page.getByRole('textbox', { name: 'Telephone Input' });
  await telephoneInput.fill('1234567890');
  await telephoneInput.blur();
  expect(await telephoneInput.inputValue()).toBe('1234567890');
});
