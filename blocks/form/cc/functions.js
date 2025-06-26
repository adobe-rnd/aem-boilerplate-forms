/**
 * Get Full Name 1
 * @name getFullName1 Concats first name and last name 1
 * @param {string} firstname in Stringformat
 * @param {string} lastname in Stringformat
 * @return {string}
 */
function getFullName1(firstname, lastname) {
    return `${firstname} ${lastname}`.trim();
}

// eslint-disable-next-line import/prefer-default-export
export { getFullName1 };
