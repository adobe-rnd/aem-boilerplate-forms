import { test, expect } from '../fixtures.js';
import { fillField, openPage } from '../utils.js';

const inputValues = {
  textInput: 'adobe',
  emailInput: 'test@adobe.com',
  numberInput: '123',
  dropDown: 'Orange',
  FilePath: './test/e2e/upload/empty.pdf',
  dataInput: '2022-12-23',
};
const partialUrl = '/L2NvbnRlbnQvZm9ybXMvYWYveHdhbGstdGVzdC1jb2xsYXRlcmFsL3N1Ym1pdHZhbGlkYXRpb24=';
const titles = ['Text Input', 'Check Box Group', 'Number Input', 'Radio Button', 'Telephone Input', 'Email Input', 'File Attachment', 'Dropdown', 'Date Input'];
test.describe('Form with Submit Button', async () => {
  const testURL = '/drafts/tests/x-walk/submitvalidation';

  test('Clicking the button should submit the form', async ({ page }) => {
    await openPage(page, testURL);
    await page.evaluate(async () => {
      // eslint-disable-next-line no-undef,no-underscore-dangle
      myForm._jsonModel.action = 'https://publish-p133911-e1313554.adobeaemcloud.com/adobe/forms/af/submit/L2NvbnRlbnQvZm9ybXMvYWYveHdhbGstdGVzdC1jb2xsYXRlcmFsL3N1Ym1pdHZhbGlkYXRpb24=';
    });
    // eslint-disable-next-line no-restricted-syntax
    for (const title of titles) {
      // eslint-disable-next-line no-await-in-loop,max-len
      await fillField(page, title, inputValues);
    }
    // eslint-disable-next-line max-len
    const responsePromise = page.waitForResponse((response) => response.url().includes(partialUrl) && response.status() === 200);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Thank you for submitting the form.')).toBeVisible();
    await responsePromise;
  });
});
