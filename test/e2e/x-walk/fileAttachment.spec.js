import { test, expect } from '../fixtures.js';
import { openForm } from '../utils.js';

const inputValues = {
  FilePath: './test/e2e/upload/test.txt',
};
const fileAttachmentText = 'Validation of attached file in preview mode in EDS';
const fileLocator = 'div[class="file-description"] span.file-description-name';

test.describe('file attachment validation', async () => {
  const testURL = 'https://main--aem-boilerplate-forms--adobe-rnd.aem.live/content/aem-boilerplate-forms-xwalk-collaterals/file-attachment';
  const componentTitle = 'File Attachment';

  test('preview and validation of file attached', async ({ page }) => {
    await openForm(page, testURL);
    await page.getByLabel(componentTitle).setInputFiles(inputValues.FilePath);
    // eslint-disable-next-line no-undef
    const [previewPage] = await Promise.all([page.waitForEvent('popup'),
      page.locator(fileLocator).click(),
    ]);

    await previewPage.waitForLoadState('load');
    const previewContent = await previewPage.locator('body').innerText();
    await expect(previewContent).toContain(fileAttachmentText);
  });
});
