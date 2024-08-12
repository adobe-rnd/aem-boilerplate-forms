import { chromium, expect } from '@playwright/test';

const userName = 'ptippa+test@adobetest.com';
const password = 'bqD_BsY2+m)32pV';
const filePath = './LoginAuth.json';
const baseUrl = 'https://author-p133911-e1313554.adobeaemcloud.com/aem/start.html';
const usernameInput = 'input[name="username"]';
const passwordInput = 'input[name="password"]';
const iFrame = 'iframe[id*="exc-app-sandbox"]';
const continueButton = '[class="spectrum-Button-label"]';
const emailValidation = '.Profile-Email';
const createAnAccount = 'a[class="spectrum-Link EmailPage__create-account-link"]';
async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordVideo: { dir: './videos/' } });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('Sign in with Adobe').click();
    await expect(page.locator(createAnAccount)).toBeVisible();
    await page.locator(usernameInput).fill(userName);
    await page.locator(continueButton).click();
    expect(await page.locator(emailValidation).innerText()).toBe(userName);
    await page.locator(passwordInput).fill(password);
    await page.getByLabel('Continue').click();
    const frame = page.frameLocator(iFrame);
    await expect(frame.getByLabel('Navigation')).toBeVisible({ timeout: 20000 });
    await page.context().storageState({ path: filePath });
  } catch (error) {
    await page.screenshot({ path: './error-screenshot.png' });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
export default globalSetup;
