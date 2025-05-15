/** ***********************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2024 Adobe
 * All Rights Reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.

 * Adobe permits you to use and modify this file solely in accordance with
 * the terms of the Adobe license agreement accompanying it.
 ************************************************************************ */
import { getSubmitBaseUrl } from '../constant.js';
/**
 * Prefixes the URL with the context path.
 * @param {string} url - The URL to externalize.
 * @returns {string} - The externalized URL.
 */
function externalize(url) {
  const submitBaseUrl = getSubmitBaseUrl();
  if (submitBaseUrl) {
    return `${submitBaseUrl}${url}`;
  }
  return url;
}

/**
 * Validates if the given URL is correct.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - True if the URL is valid, false otherwise.
 */
function validateURL(url) {
  try {
    const validatedUrl = new URL(url, window.location.href);
    return (validatedUrl.protocol === 'http:' || validatedUrl.protocol === 'https:');
  } catch (err) {
    return false;
  }
}

/**
 * Converts a JSON string to an object.
 * @param {string} str - The JSON string to convert to an object.
 * @returns {object} - The parsed JSON object. Returns an empty object if an exception occurs.
 * @memberof module:FormView~customFunctions
 */
function toObject(str) {
  if (typeof str === 'string') {
    try {
      return JSON.parse(str);
    } catch (e) {
      return {};
    }
  }
  return str;
}

/**
 * Navigates to the specified URL.
 * @param {string} destinationURL - The URL to navigate to. If not specified, a new blank window will be opened.
 * @param {string} destinationType - The type of destination. Supports the following values: "_newwindow", "_blank", "_parent", "_self", "_top", or the name of the window.
 * @returns {Window} - The newly opened window.
 */
function navigateTo(destinationURL, destinationType) {
  let param = null;
  const windowParam = window;
  let arg = null;
  switch (destinationType) {
    case '_newwindow':
      param = '_blank';
      arg = 'width=1000,height=800';
      break;
  }
  if (!param) {
    if (destinationType) {
      param = destinationType;
    } else {
      param = '_blank';
    }
  }
  if (validateURL(destinationURL)) {
    windowParam.open(destinationURL, param, arg);
  }
}

/**
 * Default error handler for the invoke service API.
 * @param {object} response - The response body of the invoke service API.
 * @param {object} headers - The response headers of the invoke service API.
 * @param {scope} globals - An object containing read-only form instance, read-only target field instance and methods for form modifications.
 * @returns {void}
 */
function defaultErrorHandler(response, headers, globals) {
  if (response && response.validationErrors) {
    response.validationErrors?.forEach((violation) => {
      if (violation.details) {
        if (violation.fieldName) {
          globals.functions.markFieldAsInvalid(violation.fieldName, violation.details.join('\n'), { useQualifiedName: true });
        } else if (violation.dataRef) {
          globals.functions.markFieldAsInvalid(violation.dataRef, violation.details.join('\n'), { useDataRef: true });
        }
      }
    });
  }
}

/**
 * Handles the success response after a form submission.
 *
 * @param {scope} globals - An object containing read-only form instance, read-only target field instance and methods for form modifications.
 * @returns {void}
 */
function defaultSubmitSuccessHandler(globals) {
  const { event } = globals;
  const submitSuccessResponse = event?.payload?.body;
  const { form } = globals;
  if (submitSuccessResponse) {
    if (submitSuccessResponse.redirectUrl) {
      window.location.href = encodeURI(submitSuccessResponse.redirectUrl);
    } else if (submitSuccessResponse.thankYouMessage) {
      const formContainerElement = document.getElementById(`${form.$id}`);
      const thankYouMessage = document.createElement('div');
      thankYouMessage.setAttribute('class', 'tyMessage');
      thankYouMessage.setAttribute('tabindex', '-1');
      thankYouMessage.setAttribute('role', 'alertdialog');
      thankYouMessage.innerHTML = submitSuccessResponse.thankYouMessage;
      formContainerElement.replaceWith(thankYouMessage);
      thankYouMessage.focus();
    }
  }
}

/**
 * Handles the error response after a form submission.
 *
 * @param {string} defaultSubmitErrorMessage - The default error message.
 * @param {scope} globals - An object containing read-only form instance, read-only target field instance and methods for form modifications.
 * @returns {void}
 */
function defaultSubmitErrorHandler(defaultSubmitErrorMessage, globals) {
  // view layer should send localized error message here
  window.alert(defaultSubmitErrorMessage);
}

/**
 * Fetches the captcha token for the form.
 *
 * This function uses the Google reCAPTCHA Enterprise/turnstile service to fetch the captcha token.
 *
 * @async
 * @param {object} globals - An object containing read-only form instance, read-only target field instance and methods for form modifications.
 * @returns {string} - The captcha token.
 */
async function fetchCaptchaToken(globals) {
  return new Promise((resolve, reject) => {
    // successCallback and errorCallback can be reused for different captcha implementations
    const successCallback = function (token) {
      resolve(token);
    };

    const errorCallback = function (error) {
      reject(error);
    };

    try {
      const captcha = globals.form.$captcha;
      if (captcha.$captchaProvider === 'turnstile') {
        const turnstileContainer = document.getElementsByClassName('cmp-adaptiveform-turnstile__widget')[0];
        const turnstileParameters = {
          sitekey: captcha.$captchaSiteKey,
          callback: successCallback,
          'error-callback': errorCallback,
        };
        if (turnstile != undefined) {
          const widgetId = turnstile.render(turnstileContainer, turnstileParameters);
          if (widgetId) {
            turnstile.execute(widgetId);
          } else {
            reject({ error: 'Failed to render turnstile captcha' });
          }
        } else {
          reject({ error: 'Turnstile captcha not loaded' });
        }
      } else {
        const siteKey = captcha?.$properties['fd:captcha']?.config?.siteKey;
        const captchaElementName = captcha.$name.replaceAll('-', '_');
        let captchaPath = captcha?.$properties['fd:path'];
        const index = captchaPath.indexOf('/jcr:content');
        let formName = '';
        if (index > 0) {
          captchaPath = captchaPath.substring(0, index);
          formName = captchaPath.substring(captchaPath.lastIndexOf('/') + 1).replaceAll('-', '_');
        }
        const actionName = `submit_${formName}_${captchaElementName}`;
        grecaptcha.enterprise.ready(() => {
          grecaptcha.enterprise.execute(siteKey, { action: actionName })
            .then((token) => resolve(token))
            .catch((error) => reject(error));
        });
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Converts a date to the number of days since the Unix epoch (1970-01-01).
 *
 * If the input date is a number, it is assumed to represent the number of days since the epoch,
 * including both integer and decimal parts. In this case, only the integer part is returned as the number of days.
 *
 * @param {string|Date|number} date - The date to convert.
 * Can be:
 * - An ISO string (yyyy-mm-dd)
 * - A Date object
 * - A number representing the days since the epoch, where the integer part is the number of days and the decimal part is the fraction of the day
 *
 * @returns {number} - The number of days since the Unix epoch
 */
function dateToDaysSinceEpoch(date) {
  let dateObj;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    return Math.floor(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    throw new Error('Invalid date input');
  }

  // Validate that date is valid after parsing
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date input');
  }
  return Math.floor(dateObj.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Private utility function to set a property value on an object
 * @param {object} target - The target object to set properties on
 * @param {string} variableName - Name of the variable to set
 * @param {*} variableValue - Value to set
 * @param {scope} globals - Global scope object
 * @private
 */
function _setPropertyValue(target, variableName, variableValue, globals) {
  const existingProperties = target.$properties || {};
  const updatedProperties = { ...existingProperties, [variableName]: variableValue };
  globals.functions.setProperty(target, { properties: updatedProperties });
}

/**
* Set global variable
* @param {string} variableName Name of the variable to set
* @param {string|object|Array} variableValue Value to set for the variable
* @param {scope} globals Global scope object
*/
function setGlobalVariable(variableName, variableValue, globals) {
  _setPropertyValue(globals.form, variableName, variableValue, globals);
}
 
/**
* Set a local variable value on current rule field
* @param {string} variableName Name of the variable to set
* @param {string|object|Array} variableValue Value to set for the variable
* @param {scope} globals Global scope object
*/
function setLocalVariable(variableName, variableValue, globals) {
  _setPropertyValue(globals.field, variableName, variableValue, globals);
}

/**
* Private utility function to get a nested value from an object using dot notation
* @param {string} path - Path to the nested value using dot notation (e.g. 'address.city')
* @param {object} obj - Object to traverse
* @returns {*} - The value at the specified path or undefined if not found
* @private
*/
function _getNestedValue(path, obj) {
  if (!path || !obj) {
      return undefined;
  }
  
  const properties = path.split('.');
  let value = obj;
  
  for (const prop of properties) {
      if (value === undefined || value === null) {
          return undefined;
      }
      value = value[prop];
  }
  
  return value;
}

/**
* Get a local variable value from given field or panel
* @param {string} variableName - Name of the variable to get (supports dot notation e.g. 'address.city')
* @param {object} [normalFieldOrPanel] - Field or panel component to get the property from (defaults to current field)
* @param {scope} globals - Global scope object containing the current field context
* @returns {string|object|Array} The value of the requested variable or undefined if not found
*/
function getLocalVariable(variableName, normalFieldOrPanel, globals) {
  // Use the provided field/panel or default to the current field from globals
  const field = normalFieldOrPanel || globals.field;
   
  // Return undefined if no property name or if the field has no properties
  if (!variableName || !field.$properties) {
    return undefined;
  }
 
  return _getNestedValue(variableName, field.$properties);
}

/**
* Get a global variable value
* @param {string} variableName - Name of the variable to get (supports dot notation e.g. 'address.city')
* @param {scope} globals - Global scope object containing the current field context
* @returns {string|object|Array} The value of the requested variable or undefined if not found
*/
function getGlobalVariable(variableName, globals) {
  if (!variableName || !globals.form.$properties) {
    return undefined;
  }
 
  return _getNestedValue(variableName, globals.form.$properties);
}

/**
* Gets the form data by exporting all field values, optionally converts to JSON string
* @param {boolean} [stringify] - Convert the form data to a JSON string, defaults to true
* @param {scope} globals - Global scope object containing form context
* @returns {string|object} The complete form data as a JSON string
*/
function getFormData(stringify, globals) {
  if (stringify === undefined || stringify === null) {
      stringify = true;
  }
  const data = globals.functions.exportData();
  // Check if data exists and is an object
  if (data && typeof data === 'object' && stringify) {
    return JSON.stringify(data);
  }
  return data;
}

/**
* Sets the form data in form fields
* @param {object} data - The form data to set
* @param {object} [containerField] - Container field component to set the data on (e.g. panel, fragment), defaults to form
* @param {scope} globals - Global scope object containing form context
* @returns {void}
*/
function setFormData(data, containerField, globals) {
  if (containerField) {
      const containerFieldQualifiedName = containerField.$qualifiedName;
      globals.functions.importData(data, containerFieldQualifiedName);
  } else {
      globals.functions.importData(data);
  }
}

/**
* Gets value for a given key from the form data, optionally converts to JSON string
* @param {string} key - The key to get the value for (supports dot notation e.g. 'address.city')
* @param {boolean} [stringify] - Convert the value to a JSON string, defaults to true
* @param {scope} globals - Global scope object containing form context
* @returns {string|object|Array} The value for the given key
*/
function getValueFromFormData(key, stringify, globals) {
  if (key === undefined || key === null) {
      return undefined;
  }
  if (stringify === undefined || stringify === null) {
      stringify = true;
  }

  const data = globals.functions.exportData();
  if (!data) {
      return undefined;
  }
  
  const value = _getNestedValue(key, data);
  
  if (value && typeof value === 'object' && stringify) {
      return JSON.stringify(value);
  }
  return value;
}

export {
  externalize,
  validateURL,
  navigateTo,
  toObject,
  defaultErrorHandler,
  defaultSubmitSuccessHandler,
  defaultSubmitErrorHandler,
  fetchCaptchaToken,
  dateToDaysSinceEpoch,
  setGlobalVariable,
  setLocalVariable,
  getLocalVariable,
  getGlobalVariable,
  getFormData,
  getValueFromFormData,
  setFormData
};
