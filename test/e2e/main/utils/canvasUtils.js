import { expect } from '../../fixtures.js';

export class CanvasUtils {

  getSelectedComponentLocator(frame, component) {
    return frame.locator(`li[data-resource*="/${component}"] [class*="node-content selected"]`);
  }

  getComponentLocator(frame, component) {
    return frame.locator(`main[class="Canvas"] [data-resource*="/${component}"]`);
  }

  async isComponentPresent(frame, component, componentName, timeout, page) {
    const locators = this.getComponentLocator(frame, component);
    const count = await locators.count();
    for (let i = 0; i < count; i++) {
      const locator = locators.nth(i);
      const componentTitle = await locator.locator('span.label').textContent();
      if (componentTitle && componentTitle.includes(componentName)) {
        await expect(locator).toBeVisible({ timeout });
        return true;
      }
    }
  }

  async selectComponent(frame, component) {
    await this.getComponentLocator(frame, component).first().click({ force: true });
  }

  async isComponentSelected(frame, component, timeout) {
    await expect(this.getSelectedComponentLocator(frame, component).first()).toBeVisible({ timeout });
  }

}
