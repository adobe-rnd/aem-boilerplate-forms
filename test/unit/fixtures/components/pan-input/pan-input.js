export const fieldDef = {
  fieldType: 'text-input',
  name: 'panNumber',
  label: { value: 'PAN Number' },
  placeholder: 'Enter PAN number',
  required: true,
  fourthCharacter: 'P',
  invalidFormatMessage: 'Please enter a valid PAN number (Format: AAAAA9999A)',
  invalidFourthCharMessage: 'Fourth character must be {fourthCharacter}',
  invalidLengthMessage: 'PAN number must be exactly 10 characters'
};

export const markUp = `
<form>
  <div class="field-wrapper">
    <label for="panNumber">PAN Number</label>
    <input type="text" id="panNumber" name="panNumber" placeholder="Enter PAN number" required>
  </div>
</form>
`;

export const extraChecks = [
  (form) => {
    const input = form.querySelector('input');
    if (input) {
      // Test uppercase conversion
      input.value = 'abcde1234f';
      input.dispatchEvent(new Event('input'));
      console.assert(input.value === 'ABCDE1234F', 'Should convert to uppercase');
      
      // Test valid PAN format
      input.value = 'ABCDE1234F';
      input.dispatchEvent(new Event('input'));
      console.assert(input.validity.valid === true, 'Should be valid PAN format');
      
      // Test invalid format
      input.value = 'ABCD12345F';
      input.dispatchEvent(new Event('input'));
      console.assert(input.validity.valid === false, 'Should be invalid PAN format');
    }
  }
];
