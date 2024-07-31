// eslint-disable-next-line import/no-import-module-exports
import { expect } from '../../fixtures.js';

// eslint-disable-next-line import/prefer-default-export
export class AddComponentsInUePage {
  selectors = {
    contentTreeLabel: '[aria-label="Content tree"]',
    experimentation: '[aria-label="Experimentation"]',
    personalization: '[aria-label="Personalization"]',
    mainInContentTree: 'li > [class*="content expandable collapsed"]',
    componentPath: 'main[class="Canvas"] [data-resource*="/',
    adaptiveFormDropdown: 'li[data-resource*="content/root/section_0/form"] p[class="arrow"]',
    componentSelectorValidation: 'li[data-resource*="/textinput"] [class="node-content selected"]',
    insertComponent: 'div[data-testid="right-rail-tools"] button[aria-haspopup]',
    formPathInContentTree: 'li[data-resource*="/root/section_0/form"] p[class*="node-content"]',
    formPathInUeSites: 'div[data-resource*="root/section_0/form"]',
    sectionTwoPath: 'li[data-resource*="content/root/section_0"] div[class*="content expandable"]',
    defaultAndBlockMenu: 'div[role="presentation"][class*="Submenu-wrapper"]',
    adaptiveFormPathInBlockMenu: 'div[role="presentation"] div[data-key="blocks_form"]',
    iFrame: 'iframe[name="Main Content"]',
    panelHeaders: 'div[class="PanelHeader"]',
    propertyPagePath: 'button[aria-label="Properties"]',
    componentTitleInProperties: 'input[aria-label="Title"]',
    deleteButton: 'button[aria-label="Delete"]',
    deleteConfirmationButton: '[data-variant="negative"][class*="aaz5ma_spectrum-ButtonGroup-Button"]',
    deletePopup: 'section[class*="spectrum-Dialog--destructive"]',
  };

  // eslint-disable-next-line class-methods-use-this
  componentLocatorForUe(component) {
    return `main[class="Canvas"] [data-resource*="/${component}"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  componentSelectorValidation(component) {
    return `li[data-resource*="/${component}"] [class="node-content selected"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  async addingComponentsInUE(frame, componentName, component) {
    await frame.locator(this.selectors.insertComponent).click();
    await expect(frame.getByLabel('Adaptive Form Components')).toBeVisible();
    expect(await frame.getByLabel('Adaptive Form Components').innerText()).toContain('Text Input');
    await frame.getByLabel(componentName).click();
    // eslint-disable-next-line max-len
    await expect(frame.locator(this.selectors.adaptiveFormDropdown)).toBeVisible({ timeout: 15000 });
    await expect(frame.locator(`${this.selectors.componentPath + component}"]`)).toBeVisible({ timeout: 20000 });
    await frame.locator(this.selectors.adaptiveFormDropdown).click();
    await expect(frame.locator(`li[data-resource*="${component}"]`)).toBeVisible({ timeout: 2000 });
  }

  async componentDelete(frame, component) {
    const adaptiveFormPath = await frame.locator(this.componentLocatorForUe(component));
    await adaptiveFormPath.click();
    await expect(frame.locator(this.componentSelectorValidation(component))).toBeVisible();
    await frame.locator(this.selectors.deleteButton).click();
    await expect(frame.locator(this.selectors.deletePopup)).toBeVisible();
    await frame.locator(this.selectors.deleteConfirmationButton).last().click();
    await expect(adaptiveFormPath).toHaveCount(0);
  }
}
