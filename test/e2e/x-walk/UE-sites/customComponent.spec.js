import { test, expect } from '../../fixtures.js';

const emoji = ['😢', '😊'];
let rating = null;
let requestPayload = null;

const selector = {
  ratingComponent: '.rating.hover',
  ratingStar: '.rating.hover span[class*=star]',
  emoji: '.rating.hover span.emoji',
};

const partialUrl = '/L2NvbnRlbnQvcmF0aW5nQ29tcG9uZW50VmFsaWRhdGlvbi9pbmRleC9qY3I6Y29udGVudC9yb290L3NlY3Rpb25fMC9mb3Jt';
const starsSelected = 'star hover selected';

test.describe('custom component validation', () => {
  const testURl = 'https://main--form-ue-range--pranay-tippa.hlx.live/content/ratingcomponentvalidation/';

  test('rating custom component validation', async ({ page }) => {
    await page.goto(testURl, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      // eslint-disable-next-line no-undef,no-underscore-dangle
      myForm._jsonModel.action = 'https://publish-p133911-e1313554.adobeaemcloud.com/adobe/forms/af/submit/L2NvbnRlbnQvcmF0aW5nQ29tcG9uZW50VmFsaWRhdGlvbi9pbmRleC9qY3I6Y29udGVudC9yb290L3NlY3Rpb25fMC9mb3Jt';
    });

    // listeners to fetch payload form submission.
    page.on('request', async (request) => {
      if (request.url().includes(partialUrl)) {
        requestPayload = request.postData();
      }
    });

    const ratingLocator = page.locator(selector.ratingComponent);
    await expect(ratingLocator).toBeVisible();
    await ratingLocator.hover();
    const elements = await page.$$(selector.ratingStar);

    // eslint-disable-next-line no-restricted-syntax
    for (const [index, element] of elements.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await element.click();
      // eslint-disable-next-line no-await-in-loop
      const className = await element.getAttribute('class');
      // eslint-disable-next-line no-await-in-loop
      await expect(className).toBe(starsSelected);
      // eslint-disable-next-line no-await-in-loop
      const emojiValue = await page.locator(selector.emoji).textContent();
      // eslint-disable-next-line no-await-in-loop
      await expect(emojiValue).toBe(index < 3 ? emoji[0] : emoji[1]);
      rating = index + 1;
    }
    await page.getByRole('button', { name: 'Submit' }).click();
    expect(requestPayload.includes(rating)).toBeTruthy();
  });
});
