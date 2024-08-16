import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

test.describe('Repeatability test', () => {
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
});
