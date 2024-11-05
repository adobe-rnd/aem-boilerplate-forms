import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

test.describe.skip('Repeatability test', () => {
  const testURL = '/drafts/tests/x-walk/repeat-test';
  test('test newly added panels are within div.repeat-wrapper', async ({ page }) => {
    await openPage(page, testURL);
    const childCount = await page.locator('.repeat-wrapper').evaluate((el) => Array.from(el.children).filter((child) => child.classList.contains('panel-wrapper')).length);
    await expect(childCount).toBe(5);
  });

  test('test colspan for repeated panels', async ({ page }) => {
    await openPage(page, testURL);
    const elements = await page.$$('main .form form .field-wrapper.col-4');
    // eslint-disable-next-line no-restricted-syntax
    for (const element of elements) {
      // eslint-disable-next-line no-await-in-loop
      const gridColumn = await element.evaluate((el) => getComputedStyle(el).getPropertyValue('grid-column'));
      expect(gridColumn).toBe('span 4');
    }
  });

  test('test the behaviour of radio button with same name for repeated panels', async ({ page }) => {
    await openPage(page, testURL);
    const radiobuttons = await page.$$('input[name="radio"]');
    await radiobuttons[0].click();
    expect(await radiobuttons[0].isChecked()).toBe(true);
    // eslint-disable-next-line no-plusplus
    for (let i = 1; i < radiobuttons.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      expect(await radiobuttons[i].isChecked()).toBe(false);
    }
  });

  test('test the behaviour of checkbox with same name for repeated panels', async ({ page }) => {
    await openPage(page, testURL);
    const checkboxes = await page.$$('input[name="checkbox"]');
    const n = checkboxes.length;
    await checkboxes[0].click();
    await checkboxes[n - 1].click();
    expect(await checkboxes[0].isChecked()).toBe(true);
    expect(await checkboxes[n - 1].isChecked()).toBe(true);
    // eslint-disable-next-line no-plusplus
    for (let i = 1; i < n - 1; i++) {
      // eslint-disable-next-line no-await-in-loop
      expect(await checkboxes[i].isChecked()).toBe(false);
    }
  });
});
