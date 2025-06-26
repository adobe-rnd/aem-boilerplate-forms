import { getFullName1 } from './cc/functions.js';

/**
 * Get Full Name from CC
 * @name getFullName2 check given first name and last name with a space in between.
 * @param {string} firstname in Stringformat
 * @param {string} lastname in Stringformat
 * @return {string}
 */
function getFullName2(firstname, lastname) {
    return `${firstname} ${lastname}`.trim();
}

// eslint-disable-next-line import/prefer-default-export
export { getFullName1, getFullName2 };
