/**
 * Mobile Input with Country Code selector.
 *
 * Properties (authored via fieldJson.properties):
 *   - countryCodesUrl {string}  URL returning JSON array of country objects.
 *                               Each object must have ISDCODE and DESCRIPTION (or COUNTRYNAME) fields.
 *                               Example: /api/country-codes.json
 *   - phoneMinLength  {number}  Minimum phone number digit count (default: 7, informational only)
 *   - phoneMaxLength  {number}  Maximum phone number digit count (default: 15)
 */

function drawCountryCode(dropdownList, searchOptions, key, onSelect) {
  let filteredOptions = key.length === 0
    ? searchOptions
    : searchOptions.filter(
      (opt) => String(opt.countryText).toLowerCase().includes(key.toLowerCase()),
    );

  if (filteredOptions.length === 0) {
    filteredOptions = searchOptions;
  }

  dropdownList.innerHTML = '';

  filteredOptions.forEach((option) => {
    const li = document.createElement('li');
    li.innerText = option.countryText;
    li.value = String(option.countryCode);
    li.classList.add('lianchor');
    li.dataset.id = `+${option.countryCode}`;
    li.addEventListener('mousedown', (e) => onSelect(e.target.dataset.id));
    dropdownList.appendChild(li);
  });
}

export default async function decorate(panel, fieldJson) {
  const searchWrapper = panel.querySelector('.field-countrycodesearch');
  const searchInput = searchWrapper?.querySelector('input');
  const countryCodeWrapper = panel.querySelector('.field-countrycode');
  const countryCodeInput = countryCodeWrapper?.querySelector('input');
  const countryCodeField = panel.querySelector('[name="countryCode"]');
  const phoneInput = panel.querySelector('input[type="number"]');

  if (searchInput) {
    searchInput.dataset.id = 'searchcode-id';
  }

  const {
    countryCodesUrl,
    phoneMaxLength = 15,
  } = fieldJson?.properties || {};

  if (phoneInput) {
    phoneInput.addEventListener('input', (event) => {
      let { value } = event.target;
      value = value.replace(/\D/g, '');
      if (value.length > phoneMaxLength) {
        value = value.slice(0, phoneMaxLength);
      }
      event.target.value = value;
    });
  }

  if (!countryCodesUrl) {
    // eslint-disable-next-line no-console
    console.warn('mobile-input: no countryCodesUrl configured — country code list will be empty.');
    return panel;
  }

  try {
    const response = await fetch(countryCodesUrl, {
      headers: {
        'Content-type': 'text/plain',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`mobile-input: failed to fetch country codes — HTTP ${response.status}`);
      return panel;
    }

    const data = await response.json();
    const seenISDCodes = new Set();
    const dropdownList = document.createElement('ul');
    dropdownList.classList.add('isd-drop-down');
    const searchOptions = [];

    const applySelection = (code) => {
      if (searchInput) {
        searchInput.value = code;
        searchInput.parentNode.dataset.visible = false;
        searchInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }
      if (countryCodeField) {
        countryCodeField.value = code;
        countryCodeField.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }
    };

    data?.forEach((item) => {
      const isdCode = item.ISDCODE;
      const countryName = item.DESCRIPTION || item.COUNTRYNAME;

      if (isdCode && countryName && !seenISDCodes.has(isdCode)) {
        seenISDCodes.add(isdCode);

        const li = document.createElement('li');
        const label = `${countryName} (+${isdCode})`;
        li.innerText = label;
        li.value = isdCode;
        li.dataset.id = `+${isdCode}`;
        li.classList.add('lianchor');
        li.addEventListener('mousedown', (e) => applySelection(e.target.dataset.id));

        dropdownList.appendChild(li);
        searchOptions.push({ countryCode: isdCode, countryText: label });
      }
    });

    if (searchWrapper) {
      searchWrapper.appendChild(dropdownList);
    }

    // Open the search dropdown when the country code field is clicked
    countryCodeWrapper?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.parentNode.dataset.visible = true;
        searchInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }
    });

    // Restrict manual entry in the country code display field to alphanumeric and '+'
    countryCodeInput?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^a-zA-Z0-9+]/g, '');
    });

    // Filter the dropdown list as the user types in the search field
    searchInput?.addEventListener('keyup', (event) => {
      drawCountryCode(dropdownList, searchOptions, event.target.value, applySelection);
    });

    // Hide the dropdown when the search field loses focus
    searchWrapper?.addEventListener('focusout', () => {
      setTimeout(() => {
        if (searchInput) {
          searchInput.parentNode.dataset.visible = false;
        }
      }, 100);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('mobile-input: failed to fetch country codes:', error);
  }

  return panel;
}
