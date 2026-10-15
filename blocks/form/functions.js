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
 * Custom submit function
 * @param {scope} globals
 */
function submitFormArrayToString(globals) {
  const data = globals.functions.exportData();
  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      data[key] = data[key].join(',');
    }
  });
  globals.functions.submitForm(data, true, 'application/json');
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
 * Get a form property value
 * @param {string} propertyName Name of the property to get (supports dot notation, e.g. 'a.b')
 * @param {scope} globals Global scope object
 * @returns {object|string|Array} The value of the requested property
 */
function getProperty(propertyName, globals) {
  if (!propertyName || !globals.form.$properties) {
    return undefined;
  }

  // Handle dot notation by splitting and traversing the object
  const properties = propertyName.split('.');
  return properties.reduce(
    (value, prop) => ((value === undefined || value === null) ? undefined : value[prop]),
    globals.form.$properties,
  );
}

/**
 * Get a form property value, parsing it as JSON if it is a JSON-encoded string
 * @param {string} propertyName Name of the property to get (supports dot notation, e.g. 'a.b')
 * @param {scope} globals Global scope object
 * @returns {Array} The value of the requested property
 */
function getArrayProperty(propertyName, globals) {
  if (!propertyName || !globals.form.$properties) {
    return undefined;
  }

  // Handle dot notation by splitting and traversing the object
  const properties = propertyName.split('.');
  const value = properties.reduce(
    (acc, prop) => ((acc === undefined || acc === null) ? undefined : acc[prop]),
    globals.form.$properties,
  );

  // Parse the value as JSON if it's a string
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If parsing fails, return the original value
      return value;
    }
  }

  return value;
}

/**
 * Get the payload of the current event
 * @param {scope} globals Global scope object
 * @returns {*} event payload - returns body if present, otherwise full payload
 */
function getCustomEventPayload(globals) {
  return globals.event.payload.body || globals.event.payload;
}

/**
 * Calculate age based on date of birth and current date time from form properties.
 * Uses the 'currentDateTime' form property (expected format 'DD MMM YYYY HH:mm:ss')
 * as the reference date, rather than the client clock.
 * @param {string|Date} dateOfBirth Date of birth in ISO format
 * @param {scope} globals Global scope object
 * @returns {number} Age in years, returns 0 if dates are invalid
 */
function calculateAge(dateOfBirth, globals) {
  let age = 0;
  if (dateOfBirth) {
    // Parse the reference date from the given format which comes from a form property
    const referenceDate = getProperty('currentDateTime', globals);
    const [day, month, year, time] = referenceDate.split(' ');
    const refDate = new Date(`${year}-${month}-${day}T${time}`);
    // Parse the date of birth
    const dob = new Date(dateOfBirth);
    // Return 0 if dates are invalid
    if (Number.isNaN(refDate.getTime()) || Number.isNaN(dob.getTime())) {
      return 0;
    }
    // Calculate age
    age = refDate.getFullYear() - dob.getFullYear();
    // Adjust age if birthday hasn't occurred yet in the reference year
    const refMonth = refDate.getMonth();
    const birthMonth = dob.getMonth();
    if (birthMonth > refMonth || (birthMonth === refMonth && dob.getDate() > refDate.getDate())) {
      age -= 1;
    }
  }
  return age;
}

/**
 * Replace all occurrences of a substring within a string
 * @param {string|Date} originString String (or Date) to process
 * @param {string} stringToReplace Substring to replace
 * @param {string} stringToReplaceWith String to replace with
 * @returns {string} String with all occurrences replaced
 */
function replaceString(originString, stringToReplace, stringToReplaceWith) {
  if (!originString || !stringToReplace) {
    return '';
  }
  let stringToProcess = originString;
  // Convert Date to string if needed
  if (originString instanceof Date) {
    stringToProcess = originString.toString();
  }
  // Replace all occurrences using split and join for ES5 compatibility
  return stringToProcess.split(stringToReplace).join(stringToReplaceWith || '');
}

/**
 * Get the complete form data as a JSON string
 * @param {scope} globals Global scope object
 * @returns {object|string} The complete form data as an object, or a JSON string if serializable
 */
function getFormDataAsString(globals) {
  const data = globals.functions.exportData();
  // Check if data exists and is an object
  if (data && typeof data === 'object') {
    return JSON.stringify(data);
  }
  return data;
}

/**
 * Remove all hyphens and underscores from a string
 * @param {string} str String to filter
 * @returns {string} The filtered string
 */
function removeHyphensAndUnderscores(str) {
  return (str || '').replace(/-/g, '').replace(/_/g, '');
}

/**
 * Validate a field's value against a pattern, marking it invalid if it does not match
 * @param {object} field Field to validate
 * @param {string|RegExp} pattern Pattern the field value must match
 * @param {string} errMssg Error message to show when validation fails
 * @param {scope} globals Global scope object
 * @returns {boolean} true if the field value matches the pattern, false otherwise
 */
function validateAuthenticator(field, pattern, errMssg, globals) {
  const fieldValue = field.$value;
  if (!fieldValue.match(pattern)) {
    globals.functions.markFieldAsInvalid(
      field.$qualifiedName,
      errMssg,
      { useQualifiedName: true },
    );
    return false;
  }
  return true;
}

const monthNames = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const monthNumbers = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Aug',
  '09': 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

/**
 * Convert a date string from one format to another. Supported tokens: YYYY, YY, MM, MMM, DD.
 * @param {string} dateStr Date string in the input format
 * @param {string} [inputFormat='YYYY-MM-DD'] Format of dateStr
 * @param {string} [outputFormat='DD/MM/YYYY'] Desired output format
 * @returns {string} The reformatted date string, or an empty string if parsing fails
 */
function transformDateFormat(dateStr, inputFormat = 'YYYY-MM-DD', outputFormat = 'DD/MM/YYYY') {
  if (dateStr === null || dateStr === undefined) {
    return '';
  }
  const resolvedOutputFormat = outputFormat === null || outputFormat === undefined ? 'DD/MM/YYYY' : outputFormat;
  const resolvedInputFormat = inputFormat === null || inputFormat === undefined ? 'YYYY-MM-DD' : inputFormat;

  const dateMap = {};

  // Find positions of date components in input format
  const yyyyIndex = resolvedInputFormat.indexOf('YYYY');
  const yyIndex = resolvedInputFormat.indexOf('YY');
  const mmIndex = resolvedInputFormat.indexOf('MM');
  const mmmIndex = resolvedInputFormat.indexOf('MMM');
  const ddIndex = resolvedInputFormat.indexOf('DD');

  const hasYear = yyyyIndex !== -1 || yyIndex !== -1;
  const hasMonth = mmIndex !== -1 || mmmIndex !== -1;
  if (!hasYear || !hasMonth || ddIndex === -1) {
    return '';
  }

  // Extract values based on positions
  if (yyyyIndex !== -1) {
    dateMap.YYYY = dateStr.substring(yyyyIndex, yyyyIndex + 4);
  } else if (yyIndex !== -1) {
    dateMap.YY = dateStr.substring(yyIndex, yyIndex + 2);
  }

  if (mmIndex !== -1 && mmmIndex === -1) {
    dateMap.MM = dateStr.substring(mmIndex, mmIndex + 2);
  } else if (mmmIndex !== -1) {
    const monthName = dateStr.substring(mmmIndex, mmmIndex + 3);
    dateMap.MM = monthNames[monthName] || '';
  }

  dateMap.DD = dateStr.substring(ddIndex, ddIndex + 2);

  // Build the result string
  let result = resolvedOutputFormat;

  // Replace year tokens
  if (resolvedOutputFormat.includes('YYYY')) {
    result = result.replace(/YYYY/, dateMap.YYYY || (`20${dateMap.YY}`));
  } else if (resolvedOutputFormat.includes('YY')) {
    result = result.replace(/YY/, dateMap.YY || dateMap.YYYY.slice(-2));
  }

  // Replace month tokens
  if (resolvedOutputFormat.includes('MMM')) {
    result = result.replace(/MMM/, monthNumbers[dateMap.MM] || '');
  } else if (resolvedOutputFormat.includes('MM')) {
    result = result.replace(/MM/, dateMap.MM);
  }

  // Replace day token
  result = result.replace(/DD/, dateMap.DD);

  return result;
}

/**
 * Get the current date and time in ISO format (UTC)
 * @returns {string} ISO format string (e.g., "2025-05-08T12:45:30.123Z")
 */
function getCurrentIsoDateTime() {
  return new Date().toISOString();
}

/**
 * Get the current date and time in ISO format, with local timezone offset applied.
 * Note: the 'Z' suffix remains in the output but the time values reflect local time.
 * @returns {string} ISO format string (e.g., "2025-02-04T12:30:00.000Z")
 */
function getCurrentIsoDateTimeLocal() {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString();
}

/**
 * Parse a JSON string into an object
 * @param {string} jsonString JSON string to parse
 * @returns {*} The parsed value, or undefined if parsing fails
 */
function parseJsonString(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return undefined;
  }
}

/**
 * Serialize a value to a JSON string
 * @param {*} value Value to serialize
 * @returns {string} The JSON string, or an empty string if serialization fails
 */
function toJsonString(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '';
  }
}

/**
 * Shift a date by a number of days and return it in YYYY-MM-DD format
 * @param {string} dayShift String indicating days to shift (e.g., "+1", "-2")
 * @returns {string} The new date in YYYY-MM-DD format
 */
function getOffsetDate(dayShift) {
  const date = new Date();
  const shift = parseInt(dayShift, 10) || 0; // Convert "+2"/"-3" to number

  date.setDate(date.getDate() + shift);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Convert an ISO date string into a human-readable string
 * @param {string} isoDateString ISO date string
 * @returns {string} Readable date string (e.g., "13 Aug 2025, 11:42:12AM"), or '' if invalid
 * @example
 * convertIsoToReadable('2025-08-13T11:42:12.630Z'); // "13 Aug 2025, 11:42:12AM"
 */
function convertIsoToReadable(isoDateString) {
  try {
    const date = new Date(isoDateString);

    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    // Month abbreviations
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get date components
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const { year } = { year: date.getFullYear() };

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours %= 12;
    hours = hours === 0 ? 12 : hours;

    return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}${ampm}`;
  } catch (error) {
    return '';
  }
}

/**
 * Get the difference between a date and the current date/time.
 * If dateTimeString is in the past the result is negative; if in the future, positive.
 * @param {string} dateTimeString Date/time string to compare against now
 * @param {string} [unit='days'] Unit of the result: 'years', 'months', 'days', 'hours',
 * 'minutes', or 'seconds'
 * @returns {number|null} The difference in the requested unit, or null if dateTimeString is invalid
 * @example
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'days'); // Returns days difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'years'); // Returns years difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'months'); // Returns months difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'hours'); // Returns hours difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'minutes'); // Returns minutes difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z', 'seconds'); // Returns seconds difference
 * getDifferenceFromCurrentDate('2024-12-25T10:00:00Z'); // Defaults to days
 */
function getDifferenceFromCurrentDate(dateTimeString, unit = 'days') {
  try {
    // Handle null/undefined input
    if (!dateTimeString) {
      return null;
    }

    // Convert string to Date object
    const inputDate = new Date(dateTimeString);

    // Validate date
    if (Number.isNaN(inputDate.getTime())) {
      return null;
    }

    // Get current date
    const currentDate = new Date();

    // Calculate difference in milliseconds
    const timeDifference = inputDate.getTime() - currentDate.getTime();

    switch (unit) {
      case 'years': {
        // Calculate years difference using millisecond-based approach for consistency
        // 365.25 accounts for leap years
        const yearsDiff = timeDifference / (1000 * 60 * 60 * 24 * 365.25);
        return timeDifference < 0 ? Math.ceil(yearsDiff) : Math.floor(yearsDiff);
      }
      case 'months': {
        // Calculate months difference using millisecond-based approach for consistency
        const monthsDiff = timeDifference / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
        return timeDifference < 0 ? Math.ceil(monthsDiff) : Math.floor(monthsDiff);
      }
      case 'hours': {
        const hoursDiff = timeDifference / (1000 * 60 * 60);
        return timeDifference < 0 ? Math.ceil(hoursDiff) : Math.floor(hoursDiff);
      }
      case 'minutes': {
        const minutesDiff = timeDifference / (1000 * 60);
        return timeDifference < 0 ? Math.ceil(minutesDiff) : Math.floor(minutesDiff);
      }
      case 'seconds': {
        const secondsDiff = timeDifference / 1000;
        return timeDifference < 0 ? Math.ceil(secondsDiff) : Math.floor(secondsDiff);
      }
      case 'days':
      default: {
        const daysDiff = timeDifference / (1000 * 60 * 60 * 24);
        return timeDifference < 0 ? Math.floor(daysDiff) : Math.ceil(daysDiff);
      }
    }
  } catch (error) {
    return null;
  }
}

/**
 * Merge two JSON objects. Properties from the second object override those from the first.
 * @param {object} a Base object
 * @param {object} b Object whose properties override those in a
 * @returns {object} Merged object
 */
function mergeJsonObjects(a, b) {
  return { ...(a || {}), ...(b || {}) };
}

/**
 * Check whether a value is an array
 * @param {*} value Value to check
 * @returns {boolean} true if value is an array, false otherwise
 */
function isArray(value) {
  return Array.isArray(value);
}

/**
 * Mask a mobile number, keeping only the last digits visible
 * @param {string|number} mobileNumber Mobile number to mask
 * @returns {string} The number with all but the last digits masked, or '' if not provided
 */
function maskMobileNumber(mobileNumber) {
  if (!mobileNumber) {
    return '';
  }
  const value = mobileNumber.toString();
  return `${'*'.repeat(5)}${value.substring(5)}`;
}

/**
 * Get a query parameter from the form's query params, matching the name case-insensitively
 * @param {string} param Name of the query parameter to retrieve
 * @param {scope} globals Global scope object containing form
 * @returns {string|undefined} The value of the query parameter, or undefined if not found
 * @example
 * // queryParams: { "UserId": "123", "sessionId": "abc" }
 * getQueryParamCaseInsensitive("userid", globals);    // "123"
 * getQueryParamCaseInsensitive("SESSIONID", globals); // "abc"
 */
function getQueryParamCaseInsensitive(param, globals) {
  const queryParams = globals?.form?.$properties?.queryParams;
  if (!param || !queryParams || typeof queryParams !== 'object') {
    return undefined;
  }
  const lowerParam = param.toLowerCase();
  const entry = Object.entries(queryParams).find(([key]) => key.toLowerCase() === lowerParam);
  return entry ? entry[1] : undefined;
}

// eslint-disable-next-line import/prefer-default-export
export {
  getFullName,
  days,
  submitFormArrayToString,
  getProperty,
  getArrayProperty,
  getCustomEventPayload,
  calculateAge,
  replaceString,
  getFormDataAsString,
  removeHyphensAndUnderscores,
  validateAuthenticator,
  transformDateFormat,
  getCurrentIsoDateTime,
  getCurrentIsoDateTimeLocal,
  parseJsonString,
  toJsonString,
  getOffsetDate,
  convertIsoToReadable,
  getDifferenceFromCurrentDate,
  mergeJsonObjects,
  isArray,
  maskMobileNumber,
  getQueryParamCaseInsensitive,
};
