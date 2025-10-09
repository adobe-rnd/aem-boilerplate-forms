import { chromium, expect } from '@playwright/test';
import fs from 'fs';

const filePath = './LoginAuth.json';
const baseUrl = 'https://author-p133911-e1313554.adobeaemcloud.com/aem/start.html';
const emailId = process.env.AEM_userName;
const password = process.env.AEM_password;

const selectors = {
  iFrame: 'iframe[id*="exc-app-sandbox"]',
  SubmitButton: 'div[class$="PasswordPage"] button[type="submit"]'
};

async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: 'test-results/' }
  });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Sign in with Adobe' }).click();
    await expect(page.getByText('Create an account').last()).toBeVisible();
    await page.getByLabel('Email address').fill(emailId);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Enter your password')).toBeVisible();
    await page.getByLabel('Password').first().fill(password);
    await page.locator(selectors.SubmitButton).click();

    const finalUrlPattern = '**/aem/aem/start.html?appId=aemshell';
    await page.waitForURL(finalUrlPattern, { timeout: 45000 });
    const frame = page.frameLocator(selectors.iFrame);
    await expect(frame.getByLabel('Navigation')).toBeVisible();
    await page.context().storageState({ path: filePath });
  } catch (error) {
    // Video will be saved automatically in test-results/
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
