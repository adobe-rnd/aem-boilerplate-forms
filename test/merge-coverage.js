import { execSync } from 'child_process';

const runCommand = (command, failOnError = true) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    // console.error(error.message);
    if (failOnError) process.exit(1);
  }
};

runCommand('c8 --reporter=json npm run test:unit');
runCommand('mv coverage/coverage-final.json coverage/coverage-final-unit.json');
runCommand("c8 --reporter=json --lines 50 npx playwright test --project='chromium'", false); // setting e2e coverage to a minimum of 50 %
runCommand('mv coverage/coverage-final.json coverage/coverage-final-e2e.json');
runCommand('nyc merge coverage .nyc_output/coverage.json');
runCommand('nyc report --check-coverage --lines 92 --functions 91 --branches 92');
