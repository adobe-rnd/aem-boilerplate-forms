/* eslint-env node */
import fs from 'node:fs';
import path from 'node:path';
import multipart from 'parse-multipart-data';
import { test, expect } from '../../fixtures.js';

const origin = 'https://attachments.test';
const fileInput = '#attachments';
const fileNames = '.file-description-name';
const removeButtons = '.file-description-remove';

function upload(name, size = 10, mimeType = 'application/pdf') {
  return { name, mimeType, buffer: Buffer.alloc(size) };
}

async function openForm(page, overrides = {}) {
  const formDef = {
    id: 'attachment-form',
    action: `${origin}/submit`,
    adaptiveform: '0.15.2',
    metadata: { grammar: 'json-formula-1.0.0', version: '1.0.0' },
    items: [{
      id: 'attachments',
      name: 'attachments',
      fieldType: 'file-input',
      type: 'file[]',
      label: { value: 'Attachments' },
      ...overrides,
    }, {
      id: 'submit',
      name: 'submit',
      fieldType: 'button',
      buttonType: 'submit',
      label: { value: 'Submit' },
      events: { click: 'submitForm()' },
    }],
  };
  await page.route(`${origin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      await route.fulfill({
        contentType: 'text/html',
        body: `<html><body><script>window.hlx = { codeBasePath: '' };</script>
          <script type="module">
            import { createForm } from '/blocks/form/form.js';
            import { initAdaptiveForm } from '/blocks/form/rules/index.js';
            const { form } = await initAdaptiveForm(${JSON.stringify(formDef)}, createForm);
            document.body.append(form);
          </script></body></html>`,
      });
    } else {
      const filePath = path.resolve(`.${pathname}`);
      if (fs.existsSync(filePath)) {
        await route.fulfill({ path: filePath });
      } else {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    }
  });
  await page.goto(origin);
  await expect(page.locator(fileInput)).toBeAttached();
  await expect(page.locator('form')).not.toHaveClass(/loading/);
  await page.waitForFunction(() => Boolean(window.myForm));
}

test.describe('multiple file attachments with the rule engine', () => {
  test('keeps picker, drop, and paste uploads synchronized after removal', async ({ page }) => {
    await openForm(page, { required: true });
    await page.locator(fileInput).setInputFiles([upload('one.pdf'), upload('two.pdf')]);
    await page.locator('.file-drag-area').evaluate((area) => {
      const dropped = new DataTransfer();
      dropped.items.add(new File(['three'], 'three.pdf', { type: 'application/pdf' }));
      area.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dropped }));
      const pasted = new DataTransfer();
      pasted.items.add(new File(['four'], 'four.pdf', { type: 'application/pdf' }));
      area.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: pasted }));
    });
    await page.locator(removeButtons).nth(1).click();
    await expect(page.locator(fileNames)).toHaveText(['one.pdf', 'three.pdf', 'four.pdf']);
    expect(await page.locator(fileInput).evaluate(
      (input) => Array.from(input.files, (file) => file.name),
    ))
      .toEqual(['one.pdf', 'three.pdf', 'four.pdf']);
    await expect.poll(() => page.evaluate(() => {
      const { value } = window.myForm.getElement('attachments');
      return value.map((file) => file.name);
    }))
      .toEqual(['one.pdf', 'three.pdf', 'four.pdf']);
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(true);
  });

  test('shows every invalid filename inline and preserves the errors during model validation', async ({ page }) => {
    await openForm(page, {
      accept: ['application/pdf'],
      maxFileSize: '1KB',
      constraintMessages: { accept: 'Use PDF files.', maxFileSize: 'Files must be under 1 KB.' },
    });
    await page.locator(fileInput).setInputFiles([
      upload('wrong.png', 10, 'image/png'),
      upload('wrong.txt', 10, 'text/plain'),
      upload('large.pdf', 2048),
      upload('larger.pdf', 4096),
      upload('valid.pdf'),
    ]);
    const message = 'Use PDF files. wrong.png, wrong.txt Files must be under 1 KB. large.pdf, larger.pdf';
    await expect(page.locator('.field-description')).toHaveText(message);
    await page.evaluate(() => window.myForm.validate());
    await expect(page.locator('.field-description')).toHaveText(message);
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(false);
    await page.locator('.files-list').evaluate((list) => {
      Array.from(list.querySelectorAll('button')).slice(0, 4).forEach((button) => button.click());
    });
    await expect(page.locator(fileNames)).toHaveText(['valid.pdf']);
    await expect(page.locator('.field-invalid')).toHaveCount(0);
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(true);
  });

  test('submits the retained files with their original contents', async ({ page }) => {
    await openForm(page);
    await page.route(`${origin}/submit`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ thankYouMessage: 'Submitted' }),
    }));
    await page.locator(fileInput).setInputFiles([
      { ...upload('one.pdf'), buffer: Buffer.from('first attachment') },
      upload('removed.pdf'),
    ]);
    await page.locator(fileInput).setInputFiles({
      ...upload('three.pdf'), buffer: Buffer.from('third attachment'),
    });
    await page.locator(removeButtons).nth(1).click();
    const submitted = page.waitForRequest(`${origin}/submit`);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const request = await submitted;
    const boundary = request.headers()['content-type'].match(/boundary=(.+)/)[1];
    const files = multipart.parse(request.postDataBuffer(), boundary)
      .filter((part) => part.filename);
    expect(files.map((file) => file.filename)).toEqual(['one.pdf', 'three.pdf']);
    expect(files.map((file) => file.data.toString()))
      .toEqual(['first attachment', 'third attachment']);
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
  });

  test('uses author count messages and recovers at the minimum and maximum boundaries', async ({ page }) => {
    await openForm(page, {
      minItems: 2,
      maxItems: 3,
      constraintMessages: { minItems: 'Attach at least two files.', maxItems: 'Attach at most three files.' },
    });
    await page.locator(fileInput).setInputFiles(upload('one.pdf'));
    await expect(page.locator('.field-description')).toHaveText('Attach at least two files.');
    await page.locator(fileInput).setInputFiles([upload('two.pdf'), upload('three.pdf')]);
    await expect(page.locator('.field-invalid')).toHaveCount(0);
    await page.locator(fileInput).setInputFiles(upload('four.pdf'));
    await expect(page.locator('.field-description')).toHaveText('Attach at most three files.');
    await page.locator(removeButtons).last().click();
    await expect(page.locator('.field-invalid')).toHaveCount(0);
    await page.locator(removeButtons).last().click();
    await page.locator(removeButtons).last().click();
    await expect(page.locator('.field-description')).toHaveText('Attach at least two files.');
  });

  test('keeps single-file replacement and optional empty fields working', async ({ page }) => {
    await openForm(page, { type: 'file', required: false });
    await expect(page.locator(fileInput)).not.toHaveAttribute('multiple');
    await page.locator(fileInput).setInputFiles(upload('one.pdf'));
    await page.locator(fileInput).setInputFiles(upload('replacement.pdf'));
    await expect(page.locator(fileNames)).toHaveText(['replacement.pdf']);
    await page.locator(removeButtons).click();
    await expect(page.locator(fileNames)).toHaveCount(0);
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(true);
  });

  test('keeps required drop uploads valid and rejects removal of the last file', async ({ page }) => {
    await openForm(page, { required: true, constraintMessages: { required: 'Attach a file.' } });
    await page.locator('.file-drag-area').evaluate((area) => {
      const files = new DataTransfer();
      files.items.add(new File(['one'], 'one.pdf', { type: 'application/pdf' }));
      area.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: files }));
    });
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(true);
    await page.locator(removeButtons).click();
    await expect(page.locator('.field-description')).toHaveText('Attach a file.');
    expect(await page.locator('form').evaluate((form) => form.checkValidity())).toBe(false);
  });

  ['file', 'file[]'].forEach((type) => {
    [undefined, 'Too big files'].forEach((customMessage) => {
      test(`${type} uses ${customMessage ? 'custom' : 'default'} size errors for one oversized file`, async ({ page }) => {
        await openForm(page, {
          type,
          maxFileSize: '1KB',
          constraintMessages: customMessage ? { maxFileSize: customMessage } : {},
        });
        await page.locator(fileInput).setInputFiles(upload('large.pdf', 2048));
        let message = customMessage || 'File too large. Reduce size and try again.';
        if (type === 'file[]') {
          message += ' large.pdf';
        }
        await expect(page.locator('.field-description')).toHaveText(message);
        await page.evaluate(() => window.myForm.validate());
        await expect(page.locator('.field-description')).toHaveText(message);
        await page.locator(removeButtons).click();
        await expect(page.locator('.field-invalid')).toHaveCount(0);
      });
    });
  });

  test('keeps prefilled model files valid and synchronizes all filenames', async ({ page }) => {
    await openForm(page, {
      accept: ['application/pdf'],
      default: [
        {
          name: 'one.pdf', mediaType: 'application/pdf', size: 10, data: '/one.pdf',
        },
        {
          name: 'two.pdf', mediaType: 'application/pdf', size: 10, data: '/two.pdf',
        },
      ],
    });
    await expect(page.locator(fileNames)).toHaveText(['one.pdf', 'two.pdf']);
    await expect(page.locator('.field-invalid')).toHaveCount(0);
    expect(await page.locator(fileInput).evaluate(
      (input) => Array.from(input.files, (file) => file.type),
    ))
      .toEqual(['application/pdf', 'application/pdf']);
  });
});
