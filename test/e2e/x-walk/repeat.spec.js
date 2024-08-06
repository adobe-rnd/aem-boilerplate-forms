import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

test.describe('Repeatability test', () => {
  const testURL = '/drafts/tests/x-walk/repeat-test';
  test('test newly added panels are within div.repeat-wrapper', async ({ page }) => {
    await openPage(page, testURL);
    const childCount = await page.locator('.repeat-wrapper').evaluate((el) => Array.from(el.children).filter((child) => child.classList.contains('panel-wrapper')).length);
    await expect(childCount).toBe(5);
  });
});
