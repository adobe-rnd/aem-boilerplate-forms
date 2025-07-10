import { exec } from "node:child_process";
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

// check if there are any component directory changes staged
const componentChanges = modifiedFiles.filter((file) => 
  file.match(/^blocks\/form\/(custom-components|components)\//) ||
  file === 'blocks/form/mappings.js'
);
if (componentChanges.length > 0) {
  const mappingSpinner = createSpinner('Updating component mappings...');
  const output = await run('npm run update:mappings --silent');
  mappingSpinner.stop('✅ Component mappings updated');
  console.log(output);
  await run('git add blocks/form/mappings.js');
}
