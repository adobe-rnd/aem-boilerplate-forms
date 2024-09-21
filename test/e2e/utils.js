import { execSync } from 'node:child_process';

function executeGitCommand(command) {
  return execSync(command)
    .toString('utf8')
    .replace(/[\n\r\s]+$/, '');
}

// eslint-disable-next-line max-len
export async function fillField(page, componentTitle, inputValues) {
  switch (componentTitle) {
    case 'Text Input':
      await page.getByLabel(componentTitle).fill(inputValues.textInput);
      break;
    case 'Email Input':
      await page.getByLabel(componentTitle).fill(inputValues.emailInput);
      break;
    case 'Telephone Input':
    case 'Number Input':
      await page.getByLabel(componentTitle).fill(inputValues.numberInput);
      break;
    case 'Check Box Group':
      await page.getByRole('checkbox', { name: 'Item 1' }).click();
      break;
    case 'Radio Button':
      await page.getByRole('radio', { name: 'Item 2' }).click();
      break;
    case 'Dropdown':
      await page.getByLabel(componentTitle).selectOption(inputValues.dropDown);
      break;
    case 'File Attachment':
      await page.getByLabel(componentTitle).setInputFiles(inputValues.FilePath);
      break;
    case 'Date Input':
      await page.getByLabel(componentTitle).focus();
      await page.getByLabel(componentTitle).fill(inputValues.dataInput);
      break;
    default:
      console.error(`${componentTitle} Title is not visible`);
      break;
  }
}

const getCurrentBranch = () => executeGitCommand('git rev-parse --abbrev-ref HEAD');
const getUrl = (relativeURL) => `https://${getCurrentBranch()}--aem-boilerplate-forms--adobe-rnd.hlx.live${relativeURL}`;

const openPage = async (page, relativeURL) => {
  const url = `https://${getCurrentBranch()}--aem-boilerplate-forms--adobe-rnd.hlx.live${relativeURL}`;
  await page.goto(url, { waitUntil: 'networkidle' });
};

export { openPage, getCurrentBranch, getUrl };
