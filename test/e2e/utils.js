import { execSync } from 'node:child_process';

function executeGitCommand(command) {
  return execSync(command)
    .toString('utf8')
    .replace(/[\n\r\s]+$/, '');
}

// eslint-disable-next-line import/prefer-default-export
export function getCurrentBranch() {
  return executeGitCommand('git rev-parse --abbrev-ref HEAD');
}
