import { test, expect } from '../../fixtures.js';
import { UniversalEditorBase } from '../../main/page/universalEditorBasePage.js';
import { ComponentUtils } from '../../main/utils/componentUtils.js';

const componentUtils = new ComponentUtils();
const universalEditorBase = new UniversalEditorBase();

const fieldPath = 'content/root/section/form';
const nestedFieldPath = 'content/root/section/form/panelcontainer';
const componentEmail = 'emailinput';
const componentNameStatus = 'Status';
const petModal = 'Pet  Form Data  Model';
const jsonURL = 'https://author-p133911-e1313554.adobeaemcloud.com/content/forms/af/forms-x-walk-collateral/datasource.-1.json';
const expectedRefs = {
  'Tags': '#.tags',
  'Category': '$.Pet.category',
};

test.describe('Validating datasource in UE', () => {
  const testURL = 'https://author-p133911-e1313554.adobeaemcloud.com/ui#/@formsinternal01/aem/universal-editor/canvas/author-p133911-e1313554.adobeaemcloud.com/content/forms/af/forms-x-walk-collateral/datasource.html';
  let frame, editorFrame, propertiesPanel, componentPathUE, componentPathTree, adaptiveFormPath;

  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto(testURL, { waitUntil: 'load' });
    frame = page.frameLocator(universalEditorBase.selectors.iFrame);
    editorFrame = frame.frameLocator(universalEditorBase.selectors.iFrameEditor);
    propertiesPanel = frame.locator(universalEditorBase.selectors.propertyPagePath);
    adaptiveFormPath = frame.locator(universalEditorBase.selectors.adaptiveFormPathInUE).first();
    componentPathUE = frame.locator(universalEditorBase.componentLocatorForUe(componentEmail));

    await expect(await propertiesPanel).toBeVisible();
    try {
      await expect(await adaptiveFormPath).toBeVisible({ timeout: 16000 });
    } catch (error) {
      const ruleEditor = frame.locator(universalEditorBase.selectors.ruleEditor);
      await expect(ruleEditor).toBeVisible({ timeout: 10000 });
      await expect(await adaptiveFormPath).toBeVisible({ timeout: 10000 });
    }
    await page.reload();
    await componentUtils.verifyAndClickContentTree(frame);
    const emailInUE = editorFrame.locator(`${universalEditorBase.selectors.componentPath}${componentEmail}"]`);
    componentPathTree = frame.locator(`li[data-resource$="${fieldPath}/${componentEmail}"][class*="treenode"]`).first();
    await expect(emailInUE.first()).toBeVisible({ timeout: 20000 });

    if (testInfo.title.includes('Verify adding a new data model')) {
      try {
        await universalEditorBase.verifyComponentDelete(page, frame, 'panelcontainer', 'Pet');
      } catch (error) {}
    }
  });

  test('Verify adding a new data model shows up in the bind reference property field. @chromium-only', async ({ page }) => {
    const datasourceFrame = frame.frameLocator(universalEditorBase.datasource.dataSourceFrame);
    const datasourceInner = datasourceFrame.frameLocator(universalEditorBase.datasource.datasourceIFrame);
    await universalEditorBase.expandContentTreeField(page, frame, fieldPath);
    await frame.locator(universalEditorBase.selectors.adaptiveFormInContentTree).locator('span').click();
    await expect(frame.locator(universalEditorBase.selectors.adaptiveFormInContentTree).locator('..')).toHaveAttribute('aria-selected', 'true');
    await componentUtils.verifyAndClickDataSource(frame);
    try {
      await datasourceInner.getByText('Select a Form').waitFor({ state: 'visible', timeout: 3000 });
      const componentPathInUE = frame.locator(universalEditorBase.componentLocatorForUe(componentEmail));
      await componentPathInUE.first().click({ force: true });
    } catch {}

    await expect(datasourceInner.getByText(petModal)).toBeVisible({ timeout: 10000 });
    const addButton = datasourceInner.locator(universalEditorBase.datasource.addButton);
    await expect(addButton).toBeDisabled();
    await datasourceInner.locator(universalEditorBase.datasource.expandAllButton).click();
    await datasourceInner.getByText('Status').click();
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(datasourceInner.getByText('Success!')).toBeVisible({ timeout: 10000 });
    await universalEditorBase.expandContentTreeField(page, frame, nestedFieldPath);
    const statusNode = frame.locator(`li[data-resource*="${nestedFieldPath}/"] label[title="${componentNameStatus}"]`).first();
    await expect(statusNode).toBeVisible();
    await statusNode.scrollIntoViewIfNeeded();
    await statusNode.click({ force: true });
    await frame.locator(universalEditorBase.selectors.propertyPagePath).click();
    await expect(frame.locator(`span:text-is("${componentNameStatus}")`).first()).toBeVisible();
    const bindRefFrame = frame.frameLocator(universalEditorBase.datasource.dataSourceFrame);
    await expect(bindRefFrame.locator(universalEditorBase.datasource.bindRef)).toBeVisible();
    const bindRefValue = await bindRefFrame.locator(universalEditorBase.datasource.bindRef).inputValue();
    expect(bindRefValue).toBe('$.Pet.status');
  });

  test('Dynamically update Bind Reference and validate reflected JSON @chromium-only', async ({ page }) => {
    await universalEditorBase.expandContentTreeField(page, frame, fieldPath);
    const componentTreeNode = frame.locator(`li[data-resource$="${fieldPath}/${componentEmail}"][class*="treenode"]`).first();
    await expect(componentTreeNode).toBeVisible();
    await componentTreeNode.click({ force: true });
    await frame.locator(universalEditorBase.selectors.propertyPagePath).click();
    const bindRefFrame = frame.frameLocator(universalEditorBase.datasource.dataSourceFrame);
    const bindRefSelectButton = bindRefFrame.locator(universalEditorBase.datasource.bindRefSelectButton);
    const bindRefInput = bindRefFrame.locator(universalEditorBase.datasource.bindRefInput);
    await expect(bindRefSelectButton).toBeVisible({ timeout: 10000 });
    const currentValue = await bindRefInput.inputValue();

    let targetLabel, expectedDataRef;
    if (currentValue === expectedRefs['Tags']) {
      targetLabel = 'Category';
      expectedDataRef = expectedRefs['Category'];
    } else {
      targetLabel = 'Tags';
      expectedDataRef = expectedRefs['Tags'];
    }
    await bindRefSelectButton.click();
    const dataSourceFrame = frame.frameLocator(universalEditorBase.datasource.dataSourceFrame);
    const datasourceIFrame = dataSourceFrame.last().frameLocator(universalEditorBase.datasource.datasourceIFrame);
    await expect(datasourceIFrame.getByText('Select a Bind Reference')).toBeVisible({ timeout: 8000 });
    await expect(datasourceIFrame.getByText(petModal)).toBeVisible();
    const selectButton = datasourceIFrame.locator(universalEditorBase.datasource.selectButton);
    await expect(selectButton).toBeDisabled();
    await datasourceIFrame.locator(universalEditorBase.datasource.expandAllButton).click();
    await datasourceIFrame.getByText(targetLabel, { exact: true }).click();
    await expect(selectButton).toBeEnabled();
    await selectButton.click();
    await expect(bindRefInput).toBeVisible({ timeout: 7000 });
    await bindRefInput.scrollIntoViewIfNeeded();
    const updatedValue = await bindRefInput.getAttribute('value');
    expect(updatedValue).toBe(expectedDataRef);
    await page.waitForTimeout(1000);
    await componentUtils.verifyAndClickDataSource(frame);
    try {
      await datasourceIFrame.getByText('Select a Form').waitFor({ state: 'visible', timeout: 3000 });
      await componentUtils.verifyAndClickContentTree(frame);
      await frame.locator(universalEditorBase.selectors.adaptiveFormInContentTree).locator('span').click();
      await componentUtils.verifyAndClickDataSource(frame);
      await datasourceIFrame.getByText('Select a Form').waitFor({ state: "visible", timeout: 3000 });
      await frame.locator(universalEditorBase.componentLocatorForUe(componentEmail)).first().click({ force: true });
    } catch {}
    await expect(datasourceIFrame.getByText(petModal)).toBeVisible({timeout: 6000});
    await datasourceIFrame.locator(universalEditorBase.datasource.expandAllButton).click();
    //
    const verificationTick = datasourceIFrame.locator(`span:has-text("${targetLabel}")`).locator('+ svg > path').last();
    await verificationTick.scrollIntoViewIfNeeded();
    await expect(verificationTick).toBeVisible();
    const actualDataRef = await waitForUpdatedJSON(page.context(), jsonURL, expectedDataRef);
    expect(actualDataRef).toBe(expectedDataRef);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.title.includes('Verify adding a new data model')) {
      await page.goto(testURL, { waitUntil: 'load' });
      await componentUtils.verifyAndClickContentTree(frame);

      await expect(frame.locator(universalEditorBase.selectors.adaptiveFormPathInUE).first()).toBeVisible({ timeout: 10000});

      const emailUEPath = frame.locator(universalEditorBase.componentLocatorForUe(componentEmail));
      if (await emailUEPath.first().isVisible({ timeout: 10000 })) {
        await universalEditorBase.verifyComponentDelete(page, frame, 'panelcontainer', 'Pet');
      }
    }
  });
});

async function waitForUpdatedJSON(context, jsonURL, expectedValue) {
  const jsonPage = await context.newPage();

  for (let i = 0; i < 10; i++) {
    const response = await jsonPage.goto(jsonURL, { timeout: 5000 });
    const json = await response.json();
    const actualRef = json['jcr:content']?.root?.section?.form?.emailinput?.dataRef;
    if (actualRef === expectedValue) {
      await jsonPage.close();
      return actualRef;
    }
    await jsonPage.waitForTimeout(1000);
  }
  await jsonPage.close();
  throw new Error(`JSON never updated. Expected: ${expectedValue}`);
}
