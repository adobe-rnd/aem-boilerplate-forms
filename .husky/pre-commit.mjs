import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { createSpinner } from "../tools/utils.js";

const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  }
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

/* Optional: Run linting before committing
const lintSpinner = createSpinner('Running linting...');
try {
  await run('npm run lint');
  lintSpinner.stop('✅ Linting passed - no issues found');
} catch (error) {
  lintSpinner.stop('❌ Linting failed:');
  console.error(error.stdout || error.message);
  console.error('\n🔧 Please fix the linting errors before committing.');
  process.exit(1);
}
*/

// check if there are any model files staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const buildSpinner = createSpinner('Building JSON files...');
  const output = await run('npm run build:json --silent');
  buildSpinner.stop('✅ JSON files built successfully');
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

// Guard: shim files must point at .min.js (prod) before committing.
// If they reference an unminified bundle (e.g. form-bundle.js instead of form-bundle.min.js)
// it means the dev was left on build:dev mode. Run `npm run build` to fix.
const SHIM_PATTERNS = [
  /(?:^|\/)blocks\/form\/form\.js$/,
  /(?:^|\/)blocks\/form\/rules\/index\.js$/,
  /(?:^|\/)blocks\/form\/rules\/RuleEngineWorker\.js$/,
  /(?:^|\/)blocks\/form\/rules\/functionRegistration\.js$/,
  /(?:^|\/)blocks\/form\/.+\/functions\.js$/,
];
const devShims = modifiedFiles.filter((f) => SHIM_PATTERNS.some((p) => p.test(f)));
for (const shim of devShims) {
  const content = readFileSync(shim, 'utf8');
  if (/\b([\w-]+-bundle|afb-runtime|afb-formatters|afb-events)\.js['"]/.test(content)) {
    console.error(
      `\nERROR: ${shim} points at an unminified bundle.\n`
      + 'Run `npm run build` to switch shims back to .min.js before committing.\n',
    );
    process.exit(1);
  }
}

