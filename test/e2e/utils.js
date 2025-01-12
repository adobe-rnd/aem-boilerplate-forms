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

const openForm = async (page, formURL) => {
  await page.goto(formURL, { waitUntil: 'networkidle' });
};

export { openForm };
