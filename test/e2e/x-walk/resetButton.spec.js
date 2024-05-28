import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

const wizardCount = ".repeat-wrapper fieldset[class='panel-wrapper field-wrapper wizard']";
const wizardPanelCount = 'ul.wizard-menu-items li.wizard-menu-item';
test.describe('resetButton validation test', () => {
  const testURL = '/drafts/tests/x-walk/wizardvalidation';
  test('resetButton validation on wizard panels', async ({ page }) => {
    await openPage(page, testURL);
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await page.getByText('Button').click();
    }
    await page.getByRole('button', { name: 'Reset' }).click();
    const Count = await page.locator(wizardCount).count();
    expect(Count).toEqual(1);
  });

  test('resetButton validation on repeatable wizard', async ({ page }) => {
    await openPage(page, testURL);
    const count = await page.locator(wizardPanelCount).count();

    for (let i = 0; i < count - 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await page.getByRole('button', { name: 'Next' }).click({ force: true });
    }
    await page.getByRole('button', { name: 'Reset' }).click();
    await Promise.all(
      [
        expect(page.getByText('Next')).toBeVisible(),
        !expect(page.getByText('Back')).not.toBeVisible(),
      ],
    );
  });
});
