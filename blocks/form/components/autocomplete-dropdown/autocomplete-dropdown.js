import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  // Get autocomplete configuration from field definition
  const {
    minSearchLength = 1,
    maxSuggestions = 10,
    caseSensitive = false,
    highlightMatches = true,
    noResultsMessage = 'No results found',
    multiSelect = false,
    placeholder = 'Type to search...'
  } = fd?.properties || {};

  // Add custom class for styling
  element.classList.add('autocomplete-dropdown-wrapper');

  // Find the select element
  const selectElement = element.querySelector('select');
  if (!selectElement) {
    console.warn('Autocomplete dropdown: No select element found');
    return;
  }

  // Hide the original select element
  selectElement.style.display = 'none';

  // Create the autocomplete container
  const autocompleteContainer = document.createElement('div');
  autocompleteContainer.className = 'autocomplete-container';
  
  // Create the input field
  const inputElement = document.createElement('input');
  inputElement.type = 'text';
  inputElement.className = 'autocomplete-input';
  inputElement.placeholder = placeholder;
  inputElement.setAttribute('aria-expanded', 'false');
  inputElement.setAttribute('aria-haspopup', 'listbox');
  inputElement.setAttribute('role', 'combobox');
  
  // Copy attributes from select element
  if (selectElement.id) inputElement.id = selectElement.id;
  if (selectElement.name) inputElement.name = selectElement.name;
  if (selectElement.required) inputElement.required = selectElement.required;
  if (selectElement.title) inputElement.title = selectElement.title;
  if (selectElement.readOnly) inputElement.readOnly = selectElement.readOnly;

  // Create the dropdown list
  const dropdownList = document.createElement('ul');
  dropdownList.className = 'autocomplete-dropdown';
  dropdownList.setAttribute('role', 'listbox');
  dropdownList.style.display = 'none';

  // Create hidden input to store the actual value
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = selectElement.name;
  hiddenInput.value = selectElement.value || '';

  // Get options from select element
  const options = Array.from(selectElement.options).map(option => ({
    value: option.value,
    text: option.textContent,
    disabled: option.disabled
  })).filter(option => !option.disabled && option.value !== '');

  // State management
  let isOpen = false;
  let selectedIndex = -1;
  let filteredOptions = [...options];

  // Function to filter options based on search term
  function filterOptions(searchTerm) {
    if (!searchTerm || searchTerm.length < minSearchLength) {
      return [];
    }

    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    return options.filter(option => {
      const text = caseSensitive ? option.text : option.text.toLowerCase();
      return text.includes(term);
    }).slice(0, maxSuggestions);
  }

  // Function to highlight matching text
  function highlightText(text, searchTerm) {
    if (!highlightMatches || !searchTerm) {
      return text;
    }

    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    const textToSearch = caseSensitive ? text : text.toLowerCase();
    const index = textToSearch.indexOf(term);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + searchTerm.length);
    const after = text.substring(index + searchTerm.length);
    
    return `${before}<mark>${match}</mark>${after}`;
  }

  // Function to render dropdown options
  function renderDropdown(optionsToShow, searchTerm = '') {
    dropdownList.innerHTML = '';
    
    if (optionsToShow.length === 0 && searchTerm.length >= minSearchLength) {
      const noResultsItem = document.createElement('li');
      noResultsItem.className = 'autocomplete-no-results';
      noResultsItem.textContent = noResultsMessage;
      dropdownList.appendChild(noResultsItem);
    } else {
      optionsToShow.forEach((option, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'autocomplete-option';
        listItem.setAttribute('role', 'option');
        listItem.setAttribute('data-value', option.value);
        listItem.setAttribute('data-index', index);
        
        if (highlightMatches && searchTerm) {
          listItem.innerHTML = highlightText(option.text, searchTerm);
        } else {
          listItem.textContent = option.text;
        }
        
        dropdownList.appendChild(listItem);
      });
    }
  }

  // Function to open dropdown
  function openDropdown() {
    if (!isOpen) {
      isOpen = true;
      dropdownList.style.display = 'block';
      inputElement.setAttribute('aria-expanded', 'true');
      element.classList.add('autocomplete-open');
    }
  }

  // Function to close dropdown
  function closeDropdown() {
    if (isOpen) {
      isOpen = false;
      dropdownList.style.display = 'none';
      inputElement.setAttribute('aria-expanded', 'false');
      element.classList.remove('autocomplete-open');
      selectedIndex = -1;
    }
  }

  // Function to select an option
  function selectOption(option) {
    inputElement.value = option.text;
    hiddenInput.value = option.value;
    
    // Update the original select element
    selectElement.value = option.value;
    
    // Trigger change event on select element
    const changeEvent = new Event('change', { bubbles: true });
    selectElement.dispatchEvent(changeEvent);
    
    closeDropdown();
  }

  // Function to update input value from select element
  function updateInputFromSelect() {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.value !== '') {
      inputElement.value = selectedOption.textContent;
      hiddenInput.value = selectedOption.value;
    } else {
      inputElement.value = '';
      hiddenInput.value = '';
    }
  }

  // Event listeners
  inputElement.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    filteredOptions = filterOptions(searchTerm);
    renderDropdown(filteredOptions, searchTerm);
    
    if (searchTerm.length >= minSearchLength) {
      openDropdown();
    } else {
      closeDropdown();
    }
    
    // Clear hidden input if no valid selection
    if (filteredOptions.length === 0) {
      hiddenInput.value = '';
      selectElement.value = '';
    }
  });

  inputElement.addEventListener('focus', () => {
    if (inputElement.value.length >= minSearchLength) {
      openDropdown();
    }
  });

  inputElement.addEventListener('blur', (e) => {
    // Delay closing to allow option clicks
    setTimeout(() => {
      closeDropdown();
    }, 150);
  });

  inputElement.addEventListener('keydown', (e) => {
    const options = dropdownList.querySelectorAll('.autocomplete-option');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
        } else {
          selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
          updateSelectedOption(options);
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelectedOption(options);
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        if (isOpen && selectedIndex >= 0 && options[selectedIndex]) {
          const option = filteredOptions[selectedIndex];
          selectOption(option);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  });

  // Function to update visual selection
  function updateSelectedOption(options) {
    options.forEach((option, index) => {
      option.classList.toggle('selected', index === selectedIndex);
    });
  }

  // Click handler for dropdown options
  dropdownList.addEventListener('click', (e) => {
    const option = e.target.closest('.autocomplete-option');
    if (option) {
      const index = parseInt(option.getAttribute('data-index'));
      const selectedOption = filteredOptions[index];
      if (selectedOption) {
        selectOption(selectedOption);
      }
    }
  });

  // Subscribe to field changes to sync with form model
  subscribe(element, formId, (_fieldDiv, fieldModel) => {
    // Listen for enum changes (when options are updated)
    fieldModel.subscribe((event) => {
      const { changes } = event.payload;
      
      changes.forEach((change) => {
        if (change.propertyName === 'enum' || change.propertyName === 'enumNames') {
          // Update options from the field model
          const enumValues = fieldModel.enum || [];
          const enumNames = fieldModel.enumNames || enumValues;
          
          // Clear and rebuild options
          options.length = 0;
          enumValues.forEach((value, index) => {
            options.push({
              value: value,
              text: enumNames[index] || value,
              disabled: false
            });
          });
          
          // Update select element options
          selectElement.innerHTML = '';
          options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
          });
          
          // Update current input if it matches an existing option
          updateInputFromSelect();
        }
        
        if (change.propertyName === 'value') {
          // Update input when value changes programmatically
          updateInputFromSelect();
        }
      });
    }, 'change');
  });

  // Assemble the autocomplete component
  autocompleteContainer.appendChild(inputElement);
  autocompleteContainer.appendChild(dropdownList);
  autocompleteContainer.appendChild(hiddenInput);
  
  // Insert after the original select element
  selectElement.parentNode.insertBefore(autocompleteContainer, selectElement.nextSibling);
  
  // Initialize with current value
  updateInputFromSelect();
}
