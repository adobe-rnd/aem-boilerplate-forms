import { test, expect } from '@playwright/test';
import { getCurrentBranch } from '../utils.js';

test.describe('error messages test', () => {
  let page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`https://${getCurrentBranch()}--aem-boilerplate-forms--adobe-rnd.hlx.live/drafts/tests/x-walk/errormessages`, { waitUntil: 'networkidle' });
  });

  test('required OOTB error message ', async () => {
    const submitButton = await page.getByRole('button', { name: 'Submit' });
    await submitButton.click();
    const f1 = await page.locator('input[name="f1"]').locator('..');
    expect(await f1.locator('.field-description').innerText()).toBe('Please fill in this field.');
    const f2 = await page.locator('input[name="f2"]').locator('..');
    expect(await f2.locator('.field-description').innerText()).toBe('Please fill in this field.');
    const f3 = await page.locator('fieldset[name="f3"]');
    expect(await f3.locator('.field-description').innerText()).toBe('Please fill in this field.');
    const f4 = await page.locator('fieldset[name="f4"]');
    expect(await f4.locator('.field-description').innerText()).toBe('Please fill in this field.');
    const f5 = await page.locator('input[name="f5"]').locator('../..');
    expect(await f5.locator('.field-description').innerText()).toBe('Please fill in this field.');
    const f6 = await page.locator('input[name="f6"]').locator('..');
    expect(await f6.locator('.field-description').innerText()).toBe('Please fill in this field.');
  });

  test('custom required error message', async () => {
    const submitButton = await page.getByRole('button', { name: 'Submit' });
    await submitButton.click();
    const f7 = await page.locator('input[name="f7"]').locator('..');
    expect(await f7.locator('.field-description').innerText()).toBe('This is a required text field, please fill this.');
  });

  test('minLength and maxLength error messages', async () => {
    const f1 = await page.locator('input[name="f1"]');
    await f1.fill('a');
    await f1.press('Tab');
    expect(await f1.locator('..').locator('.field-description').innerText()).toBe('Please lengthen this text to 2 characters or more.');
    await f1.fill('abcdef');
    await f1.press('Tab');
    expect(await f1.inputValue()).toBe('abcde'); // cannot input more than 5 characters
  });

  test('pattern error message', async () => {
    const f6 = await page.locator('input[name="f6"]');
    await f6.fill('abc');
    await f6.press('Tab');
    expect(await f6.locator('..').locator('.field-description').innerText()).toBe('Specify the value in allowed format : email.');
    // TODO: test for datepicker also
  });

  test('rangeOverflow and rangeUnderflow error messages', async () => {
    const f2 = await page.locator('input[name="f2"]');
    await f2.fill('1');
    await f2.press('Tab');
    expect(await f2.locator('..').locator('.field-description').innerText()).toBe('Value must be greater than or equal to 2.');
    await f2.fill('11');
    await f2.press('Tab');
    expect(await f2.locator('..').locator('.field-description').innerText()).toBe('Value must be less than or equal to 10.');
  });
});
