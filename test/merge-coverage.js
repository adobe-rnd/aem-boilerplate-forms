import { execSync } from 'child_process';

const runCommand = (command, failOnError = true) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    // console.error(error.message);
    if (failOnError) process.exit(1);
  }
};

runCommand('c8 --reporter=json --lines 85 npm run test:unit', false);
runCommand('mv coverage/coverage-final.json coverage/coverage-final-unit.json');
runCommand("c8 --reporter=json --lines 50 npx playwright test --project='chromium'", false); // e2e test should have minimum 50% coverage
runCommand('mv coverage/coverage-final.json coverage/coverage-final-e2e.json');
runCommand('nyc merge coverage .nyc_output/coverage.json');
runCommand('nyc report --check-coverage --lines 92 --functions 90 --branches 90'); // total lines covereage shoule be above 92
