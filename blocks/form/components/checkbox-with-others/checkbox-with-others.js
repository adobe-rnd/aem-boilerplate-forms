import { subscribe } from '../../rules/index.js';

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const otherOptionLabels = ['other', 'Other'];
  subscribe(fieldDiv, formId, async (element, fieldModel) => {
    const otherInput = fieldDiv.querySelector('.text-wrapper input[name*="othertextinput"]');
    if (otherInput) {
      otherInput.addEventListener('blur', (e) => {
        // eslint-disable-next-line no-underscore-dangle
        const checkboxField = fieldModel._children.find((child) => child.fieldType === 'checkbox-group');
        if (checkboxField) {
          const otherIndex = checkboxField.enumNames
            .findIndex((name) => otherOptionLabels.includes(name));
          if (otherIndex !== -1) {
            const oldValue = checkboxField.enum[otherIndex];
            checkboxField.enum[otherIndex] = e.target.value;
            const idx = checkboxField.value.indexOf(oldValue);
            if (idx !== -1) {
              checkboxField.value[idx] = e.target.value;
            }
          }
        }
      });
    }
  });
}
