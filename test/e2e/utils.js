import { execSync } from 'node:child_process';

function executeGitCommand(command) {
  return execSync(command)
    .toString('utf8')
    .replace(/[\n\r\s]+$/, '');
}

const getCurrentBranch = () => executeGitCommand('git rev-parse --abbrev-ref HEAD');
const openPage = async (page, relativeURL) => {
  const url = `https://${getCurrentBranch()}--aem-boilerplate-forms--adobe-rnd.hlx.live${relativeURL}`;
  await page.goto(url, { waitUntil: 'networkidle' });
};

export { openPage, getCurrentBranch };
