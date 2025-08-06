import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';


test.describe('form variables test suite', () => {
const url = '/content/aem-boilerplate-forms-xwalk-collaterals/variables?accountCode=A1234&utm_campaign=test_campaign';
test('check query params and browser details are getting set in properties', async ({ page }) => {
    await openPage(page, url);
    // on form init an api is invoked and its reponse is set as the value of text input field
    const accountCode = await page.getByLabel('Account Code');
    const utmCampaign = await page.getByLabel('UTM Campaign');
    const browserLanguage = await page.getByLabel('Browser Language');
    await expect(accountCode).toHaveValue('A1234');
    await expect(utmCampaign).toHaveValue('test_campaign');
    await expect(browserLanguage).toHaveValue('en-US');  
  });
});