import { test, expect } from '../fixtures.js';
import { openPage } from '../utils.js';

test.describe('Enum enum names test', () => {
  const selectors = {
    radiobutton: 'radiobutton-10c92a3406',
    checkbox: 'checkboxgroup-65290862b4',
    dropdown: 'dropdown-70c7710d18',
  };

  const checkEnumValues = async (page, enums, id) => {
    const actualEnums = await page.evaluate((selector) => {
      const inputs = selector.startsWith('dropdown') ? document.querySelectorAll(`#${selector} option`) : document.querySelectorAll(`#${selector} input`);
      return Array.from(inputs).map((input) => input.value);
    }, id);
    expect(actualEnums).toEqual(enums);
  };

  const checkEnumNameValues = async (page, enums, id) => {
    const actualEnums = await page.evaluate((selector) => {
      const labels = selector.startsWith('dropdown') ? document.querySelectorAll(`#${selector} option`) : document.querySelectorAll(`#${selector} label`);
      return Array.from(labels).map((label) => label.innerText);
    }, id);
    expect(actualEnums).toEqual(enums);
  };

  test('Test in radiobutton', async ({ page }) => {
    const enums = ['a', 'b', 'c'];
    const enumNames = ['A', 'B', 'C'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.radiobutton).enum = x.enums;
      window.myForm.getElement(x.radiobutton).enumNames = x.enumNames;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.radiobutton);
    await checkEnumNameValues(page, enumNames, selectors.radiobutton);
  });

  test('Test in checkbox', async ({ page }) => {
    const enums = ['a', 'b', 'c'];
    const enumNames = ['A', 'B', 'C'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.checkbox).enum = x.enums;
      window.myForm.getElement(x.checkbox).enumNames = x.enumNames;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.checkbox);
    await checkEnumNameValues(page, enumNames, selectors.checkbox);
  });

  test('Test in dropdown', async ({ page }) => {
    const enums = ['a', 'b', 'c'];
    const enumNames = ['A', 'B', 'C'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.dropdown).enum = x.enums;
      window.myForm.getElement(x.dropdown).enumNames = x.enumNames;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.dropdown);
    await checkEnumNameValues(page, enumNames, selectors.dropdown);
  });

  test('Test with enums > number of items - radio', async ({ page }) => {
    const enums = ['a', 'b', 'c'];
    const enumNames = ['Item 1', 'Item 2', 'c'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.radiobutton).enum = x.enums;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.radiobutton);
    await checkEnumNameValues(page, enumNames, selectors.radiobutton);
  });

  test('Test with enums > number of items - dropdown', async ({ page }) => {
    const enums = ['a', 'b', 'c'];
    const enumNames = ['Item 1', 'Item 2', 'c'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.dropdown).enum = x.enums;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.dropdown);
    await checkEnumNameValues(page, enumNames, selectors.dropdown);
  });

  test('Test with enums < number of items - radio', async ({ page }) => {
    const enums = ['a'];
    const enumNames = ['Item 1'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.radiobutton).enum = x.enums;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.radiobutton);
    await checkEnumNameValues(page, enumNames, selectors.radiobutton);
  });

  test('Test with enums < number of items - dropdown', async ({ page }) => {
    const enums = ['a'];
    const enumNames = ['Item 1'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.dropdown).enum = x.enums;
    }, { ...selectors, enums, enumNames });
    await checkEnumValues(page, enums, selectors.dropdown);
    await checkEnumNameValues(page, enumNames, selectors.dropdown);
  });

  test('Test with enumsNames > number of items - radio', async ({ page }) => {
    const enumNames = ['A', 'B', 'C'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.radiobutton).enumNames = x.enumNames;
    }, { ...selectors, enumNames });
    await checkEnumValues(page, ['0', '1'], selectors.radiobutton);
    await checkEnumNameValues(page, ['A', 'B'], selectors.radiobutton);
  });

  test('Test with enumsNames > number of items - dropdown', async ({ page }) => {
    const enumNames = ['A', 'B', 'C'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.dropdown).enumNames = x.enumNames;
    }, { ...selectors, enumNames });
    await checkEnumValues(page, ['0', '1'], selectors.dropdown);
    await checkEnumNameValues(page, ['A', 'B'], selectors.dropdown);
  });

  test('Test with enumsNames < number of items - radio', async ({ page }) => {
    const enumNames = ['A'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.radiobutton).enumNames = x.enumNames;
    }, { ...selectors, enumNames });
    await checkEnumValues(page, ['0', '1'], selectors.radiobutton);
    await checkEnumNameValues(page, ['A', '1'], selectors.radiobutton);
  });

  test('Test with enumsNames < number of items - dropdown', async ({ page }) => {
    const enumNames = ['A'];
    await openPage(page, '/drafts/tests/x-walk/enum-enumnames');
    await page.evaluate(async (x) => {
      window.myForm.getElement(x.dropdown).enumNames = x.enumNames;
    }, { ...selectors, enumNames });
    await checkEnumValues(page, ['0', '1'], selectors.dropdown);
    await checkEnumNameValues(page, ['A', '1'], selectors.dropdown);
  });
});
