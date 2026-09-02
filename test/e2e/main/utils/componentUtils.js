import { expect } from '../../fixtures.js';

export class ComponentUtils {
  selectors = {
    contentTreeLabel: '[aria-label="Content tree"]',
    deleteButton: 'button[aria-label="Delete"]',
    searchLocator: 'input[placeholder="Search component"][type="search"]'
  };

  async addComponent(frame, componentName) {
    await expect(frame.locator(this.selectors.searchLocator)).toBeVisible();
    await frame.locator(this.selectors.searchLocator).fill(componentName);
    await frame.locator(this.selectors.searchLocator).press('Enter');
    await expect(frame.getByLabel(componentName)).toBeVisible();
    await frame.getByLabel(componentName).click();
  }

  async deleteComponent(frame) {
    await frame.locator(this.selectors.deleteButton).click();
    await expect(frame.getByText("The selected component will be permanently deleted.")).toBeVisible();
    await frame.getByText("OK").click();
  }
  async verifyAndClickContentTree(frame) {
    const contentTreeLabel = frame.locator(this.selectors.contentTreeLabel).first();
    await expect(contentTreeLabel).toBeVisible({ timeout: 10000 });
    const isContentTreeVisible = await frame
      .getByText('Content tree')
      .isVisible()
      .catch(() => false);
    if (!isContentTreeVisible) {
      await contentTreeLabel.click();
    }
  }
}
