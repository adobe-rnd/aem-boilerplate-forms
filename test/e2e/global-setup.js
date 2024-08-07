import { chromium, expect } from '@playwright/test';


const userName = process.env.AEM_username;
const password = process.env.AEM_password;

const filePath = './LoginAuth.json';
const baseUrl = 'https://author-p133911-e1313554.adobeaemcloud.com/aem/start.html';
const usernameInput = 'input[name="username"]';
const passwordInput = 'input[name="password"]';
const iFrame = 'iframe[id*="exc-app-sandbox"]';
const continueButton = '[class="spectrum-Button-label"]';
const emailValidation = '.Profile-Email';
const createAnAccount = 'a[class="spectrum-Link EmailPage__create-account-link"]';

async function globalSetup() {
  // eslint-disable-next-line no-console
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
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
  await browser.close();
}
export default globalSetup;
