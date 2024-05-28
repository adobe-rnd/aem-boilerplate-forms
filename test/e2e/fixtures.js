import { test as base, expect } from '@playwright/test';
import fsPromises from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { URL, fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const test = base.extend({
  saveCoverageInfo: [async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use();
    const coverage = await page.coverage.stopJSCoverage();
    const srcPath = '/blocks/form/';
    const basePath = path.normalize(`${dirname}/../..`);
    const srcCoverage = coverage
      .filter(({ url }) => url.includes(srcPath))
      .map(({ source, ...entry }) => {
        const fileName = new URL(entry.url).pathname;
        return { ...entry, url: `file://${basePath}${fileName}` };
      });
    await fsPromises.mkdir('coverage/tmp', { recursive: true });
    await fsPromises.writeFile(
      `coverage/tmp/coverage-${crypto.randomUUID()}.json`,
      JSON.stringify({ result: srcCoverage }),
    );
  }, { auto: true }],
});

export { test, expect };
