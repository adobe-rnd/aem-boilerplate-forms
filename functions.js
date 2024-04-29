/**
 * Get Full Name
 * @name getFullName Concats first name and last name
 * @param {string} firstname in Stringformat
 * @param {string} lastname in Stringformat
 * @return {string}
 */
function getFullName(firstname, lastname) {
  return `${firstname} ${lastname}`.trim();
}

/**
 * Calculate the number of days between two dates.
 * @param {*} endDate
 * @param {*} startDate
 * @returns {number} returns the number of days between two dates
 */
function days(endDate, startDate) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  // return zero if dates are valid
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffInMs = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats telephone input by masking the first 6 digits and appends +91
 * @name formatTelephoneInput Formats telephone input
 * @param {object} field field whose value to be formatted
 * @return {string}
 */
function formatTelephoneInput(field) {
  const phoneNumber = field.$value;
  if (phoneNumber) {
    const maskedPhoneNumber = phoneNumber.replace(/.(?=.{4,}$)/g, '*');
    return `+91 ${maskedPhoneNumber}`;
  }
  return phoneNumber || '';
}

// eslint-disable-next-line import/prefer-default-export
export { getFullName, days, formatTelephoneInput };
