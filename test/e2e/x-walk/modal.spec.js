import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

const locators = [
  { name: 'firstName', selector: 'div[class*="field-firstname"] input' },
  { name: 'lastName', selector: 'div[class*="field-lastname"] input' },
  { name: 'fullName', selector: 'div[class*="field-fullname"] input' },
];

test.describe('Modal Form Test', () => {
  const elements = {};
  const testURL = '/content/aem-boilerplate-forms-xwalk-collaterals/model-validation';
  test('Open and close modal', async ({ page }) => {
    await openPage(page, testURL);
    const button = await page.getByText('Click to Open Modal');
    await button.click();
    const dialog = await page.locator('div.modal dialog');
    await expect(dialog).toBeVisible();
    const closeButton = await page.locator('button.close-button');
    await closeButton.click();
    await expect(dialog).toBeHidden();
  });

  test('Test Rules inside Modal', async ({ page }) => {
    await openPage(page, testURL);
    const button = await page.getByText('Click to Open Modal');
    await button.click();
    const dialog = await page.locator('div.modal dialog');
    await expect(dialog).toBeVisible();
    // eslint-disable-next-line no-restricted-syntax
    for (const locator of locators) {
      elements[locator.name] = page.locator(locator.selector);
    }
    await elements.firstName.fill('John');
    await elements.lastName.fill('Doe');
    await elements.lastName.blur();
    await expect(elements?.fullName).toHaveValue('JohnDoe');
  });

  test('form is interactive when modal is closed', async ({ page }) => {
    await openPage(page, testURL);
    const button = await page.getByText('Click to Open Modal');
    await button.click();
    const dialog = await page.locator('div.modal dialog');
    await expect(dialog).toBeVisible();
    const closeButton = await page.getByText('Close');
    await closeButton.click();
    await expect(dialog).toBeHidden();
    const textField = await page.getByLabel('Text Input');
    await textField.fill('Hello');
    await expect(textField).toHaveValue('Hello');
  });
});
