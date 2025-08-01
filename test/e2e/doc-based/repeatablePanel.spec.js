import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

const panelLocator = 'fieldset[class*="panel-wrapper field-panel-1 field-wrapper"]';
const radioButtonLocator = 'fieldset[class*="field-radio"]';
test.describe('Repeatability test in Doc-based forms', () => {
  const testURL = '/repeatablepanel';

  test('test the behaviour of correctly add and remove repeatable panel in Doc-based forms', async ({ page }) => {
    await openPage(page, testURL, 'docbased');
    const panel = page.locator(panelLocator);
    const addButton = page.getByText('Add');
    const deleteButton = page.getByText('Delete');
    await expect(panel).toHaveCount(1);
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(panel).toHaveCount(2);
    const panelCount = await panel.count();
    for (let i = 0; i < panelCount; i++) {
      await expect(panel.nth(i)).toBeVisible();
    }
    await expect(addButton).toBeHidden();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await expect(addButton).toBeVisible();
    await expect(panel).toHaveCount(1);
  });

  test('Validation of repeatable panel radiobuttons are updated correctly', async ({ page }) => {
    await openPage(page, testURL, 'docbased');
    const panel = page.locator(panelLocator);
    const radioButton = page.locator(radioButtonLocator);
    const addButton = page.getByText('Add');
    const item2Radios = radioButton.getByRole('radio', { name: 'Item 2' });

    await expect(panel).toHaveCount(1);
    await expect(radioButton).toHaveCount(1);
    await expect(addButton).toBeVisible();
    await item2Radios.click();
    await addButton.click();
    await expect(panel).toHaveCount(2);
    await item2Radios.nth(1).click();
    await Promise.all(
      [
        expect(item2Radios.first()).toBeChecked(),
        expect(item2Radios.nth(1)).toBeChecked(),
      ],
    );
  });
});