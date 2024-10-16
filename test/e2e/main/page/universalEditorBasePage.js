// eslint-disable-next-line import/no-import-module-exports
import { expect } from '../../fixtures.js';

// eslint-disable-next-line import/prefer-default-export
export class UniversalEditorBase {
  selectors = {
    contentTreeLabel: '[aria-label="Content tree"]',
    ruleEditor: 'button[aria-label="Rule Editor"]',
    preview: '[aria-label="Preview"]',
    mainInContentTree: 'li > [class*="content expandable collapsed"]',
    adaptiveFormPathInUE: 'main[class="Canvas"] div[data-resource*="content/root/section_0/form"]',
    componentPath: 'main[class="Canvas"] [data-resource*="/',
    adaptiveFormDropdown: 'li[data-resource*="content/root/section_0/form"] button[aria-label]',
    componentSelectorValidation: 'li[data-resource*="/textinput"] [class="node-content selected"]',
    insertComponent: 'div[data-testid="right-rail-tools"] button[aria-haspopup]',
    formPathInContentTree: 'li[data-resource*="/root/section_0/form"] p[class*="node-content"]',
    formPathInUeSites: 'div[data-resource*="root/section_0/form"]',
    sectionTwoPath: 'li[data-resource*="content/root/section_0"] div[class*="content expandable"]',
    defaultAndBlockMenu: 'div[role="presentation"][class*="Submenu-wrapper"]',
    adaptiveFormPathInBlockMenu: 'div[role="presentation"] div[data-key="blocks_form"]',
    iFrame: 'iframe[name="Main Content"]',
    iFrameInPreview: 'iframe[class="penpal"]',
    panelHeaders: 'div[class="PanelHeader"]',
    propertyPagePath: 'button[aria-label="Properties"]',
    componentTitleInProperties: 'textarea[aria-label="Title"]',
    deleteButton: 'button[aria-label="Delete"]',
    deleteConfirmationButton: '[data-variant="negative"][class*="aaz5ma_spectrum-ButtonGroup-Button"]',
    deletePopup: 'section[class*="spectrum-Dialog--destructive"]',
    adaptiveFormPathInContentTree: 'li[data-resource$="content/root/section_0/form"][class="treenode selected"]',
    selectedAdaptiveFormWithComponent: 'li[data-resource$="content/root/section_0/form"][class*="treenode selected expandable"] div[class="node-content selected-content"]',
  };

  // eslint-disable-next-line class-methods-use-this
  componentLocatorForPreview(componentName) {
    return `div[data-id*="${componentName}"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  componentLocatorForUe(component) {
    return `main[class="Canvas"] [data-resource*="/${component}"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  componentSelectorValidation(component) {
    return `li[data-resource*="/${component}"] [class*="node-content selected"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  async waitForCountToDecreaseByOne(adaptiveFormPath, initialCount) {
    // eslint-disable-next-line no-await-in-loop
    while (await adaptiveFormPath.count() !== initialCount - 1) {
      // eslint-disable-next-line no-await-in-loop
      await adaptiveFormPath.page().waitForTimeout(100);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getExpandCollapseButton(action) {
    return `li[data-resource$="content/root/section_0/form"][class*="treenode selected expandable"] div[class="node-content selected-content"] button[aria-label="${action} Node"]`;
  }

  // eslint-disable-next-line class-methods-use-this
  async verifyComponentInsert(frame, componentName, component) {
    await frame.locator(this.selectors.insertComponent).click();
    await expect(frame.getByLabel('Adaptive Form Components')).toBeVisible();
    expect(await frame.getByLabel('Adaptive Form Components').innerText()).toContain('Text Input');
    await frame.getByLabel(componentName).click();
    // eslint-disable-next-line max-len
    await expect(frame.locator(this.selectors.adaptiveFormDropdown)).toBeVisible({ timeout: 15000 });
    await expect(frame.locator(`${this.selectors.componentPath + component}"]`)).toBeVisible({ timeout: 20000 });
    await frame.locator(`${this.selectors.componentPath + component}"]`).click();
    await expect(frame.locator(`li[data-resource*="${component}"]`)).toBeVisible({ timeout: 2000 });
  }

  async verifyComponentDelete(page, frame, component) {
    let adaptiveFormPath = frame.locator(this.componentLocatorForUe(component));
    let count = await adaptiveFormPath.count();

    while (count > 0) {
      // eslint-disable-next-line no-await-in-loop
      await expect(adaptiveFormPath.first()).toBeVisible();
      // eslint-disable-next-line no-await-in-loop
      await adaptiveFormPath.first().click();

      // eslint-disable-next-line max-len,no-await-in-loop
      const isComponentSelected = await frame.locator(this.componentSelectorValidation(component)).isVisible();
      // eslint-disable-next-line max-len,no-await-in-loop
      const isAdaptiveFormSelected = await frame.locator(this.selectors.selectedAdaptiveFormWithComponent).isVisible();

      // eslint-disable-next-line no-await-in-loop
      if (!isComponentSelected && isAdaptiveFormSelected) {
        const expandButton = frame.locator(this.getExpandCollapseButton('Expand'));
        // eslint-disable-next-line no-await-in-loop
        if (await expandButton.isVisible()) {
          // eslint-disable-next-line no-await-in-loop
          await expandButton.click();
          // eslint-disable-next-line no-await-in-loop
          await expect(frame.locator(this.getExpandCollapseButton('Collapse'))).toBeVisible();
        }
        // eslint-disable-next-line no-await-in-loop
        await frame.locator(`li[data-resource*="/${component}"]`).click();
        // eslint-disable-next-line no-await-in-loop,max-len
        expect(await frame.locator(this.componentSelectorValidation(component)).isVisible()).toBe(true);
      }

      // eslint-disable-next-line no-await-in-loop
      if (await frame.locator(this.selectors.adaptiveFormPathInContentTree).isVisible()) {
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      await frame.locator(this.selectors.deleteButton).click();
      // eslint-disable-next-line no-await-in-loop
      await expect(frame.locator(this.selectors.deletePopup)).toBeVisible();
      // eslint-disable-next-line no-await-in-loop
      await frame.locator(this.selectors.deleteConfirmationButton).last().click();
      // eslint-disable-next-line no-await-in-loop
      await this.waitForCountToDecreaseByOne(adaptiveFormPath, count);
      adaptiveFormPath = frame.locator(this.componentLocatorForUe(component));
      // eslint-disable-next-line no-await-in-loop
      count = await adaptiveFormPath.count();
    }

    await expect(adaptiveFormPath).toHaveCount(0);
  }
}
