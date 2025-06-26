import { chromium, expect } from '@playwright/test';

const filePath = './LoginAuth.json';
const baseUrl = 'https://author-p133911-e1313554.adobeaemcloud.com/aem/start.html';
const emailId = process.env.AEM_userName;
const password = process.env.AEM_password;

const selectors = {
  iFrame: 'iframe[id*="exc-app-sandbox"]',
  signInWithAdobe: 'text=Sign in with Adobe',
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  firstExtButtonItem: 'div[class*="ext-button-item"]:first-child',
  signInButton: 'button[type="submit"]',
  signInWithMicrosoft: '[data-id="EmailPage-MicrosoftSignInButton"]'
};

async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const emailLocator = page.locator(selectors.emailInput);
  const passwordLocator = page.locator(selectors.passwordInput);
  await page.locator(selectors.signInWithAdobe).click();
  await expect(page.getByText('Create an account').last()).toBeVisible();
  await page.getByRole('link', { name: 'View more' }).click();
  const microsoftSignInButton = page.locator(selectors.signInWithMicrosoft);
  await expect(microsoftSignInButton).toBeVisible();
  await microsoftSignInButton.click();
  await page.waitForLoadState('networkidle');
  await expect(emailLocator).toBeVisible();
  await emailLocator.fill(emailId);
  await emailLocator.blur();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(emailId)).toBeVisible();
  const usePasswordLink = page.getByText('Use your password');
  if (await usePasswordLink.isVisible()) {
    await usePasswordLink.click();
  }
  await passwordLocator.fill(password);
  await passwordLocator.blur();
  await page.locator(selectors.signInButton).click();
  await expect(page.getByText('Stay signed in?')).toBeVisible();
  await page.getByRole('button', { name: 'No' }).click();
  await page.waitForURL('https://author-p133911-e1313554.adobeaemcloud.com/ui#/aem/aem/start.html', { timeout: 30000 });
  await page.waitForLoadState('load');
  await page.waitForURL('https://author-p133911-e1313554.adobeaemcloud.com/ui#/aem/aem/start.html?appId=aemshell');
  const frame = page.frameLocator(selectors.iFrame);
  await expect(frame.getByLabel('Navigation')).toBeVisible();
  await page.context().storageState({ path: filePath });
  await context.close();
  await browser.close();
}

export default globalSetup;
