import { updateOrCreateInvalidMsg, stripTags } from '../../util.js';
import { fileAttachmentText, dragDropText, defaultErrorMessages } from '../../constant.js';

const fileSizeRegex = /^(\d*\.?\d+)(\\?(?=[KMGT])([KMGT])(?:i?B)?|B?)$/i;

/**
 * converts a string of the form "10MB" to bytes. If the string is malformed 0 is returned
 * @param {*} str
 * @returns
 */
function getSizeInBytes(str) {
  const sizes = {
    KB: 1, MB: 2, GB: 3, TB: 4,
  };
  let sizeLimit = 0;
  const matches = fileSizeRegex.exec(str.trim());
  if (matches != null) {
    const symbol = matches[2] || 'kb';
    const size = parseFloat(matches[1]);
    const i = 1024 ** sizes[symbol.toUpperCase()];
    sizeLimit = Math.round(size * i);
  }
  return sizeLimit;
}

/**
 * matches a file's media type or filename extension with the accepted types
 * @param {File} file file to match
 * @param {[]} accepts accepted mediaTypes
 * @returns false if the mediaType is not accepted
 */
function matchMediaType(file, accepts) {
  return accepts.some((accept) => {
    if (accept.startsWith('.')) {
      return file.name.toLowerCase().endsWith(accept);
    }
    const mediaType = (file.type || file.mediaType || '').toLowerCase();
    return accept.endsWith('/*')
      ? mediaType.startsWith(accept.slice(0, -1))
      : accept === mediaType;
  });
}

/**
 * triggers file Validation for the given input element and updates the error message
 *
 * File validation is currently DOM-based for BOTH Sheet and AEM forms
 * (exception to standard architecture).
 * This component validates: required, accept, maxFileSize, minItems, maxItems.
 *
 * TODO: Remove this DOM-based validation for AEM forms and use afb-runtime's
 * built-in file validation. afb-runtime already supports: ACCEPT_MISMATCH,
 * FILE_SIZE_MISMATCH, MIN_ITEMS_MISMATCH, MAX_ITEMS_MISMATCH.
 * After this change, this component would only be needed for Sheet forms.
 * Remove the bypass logic in rules/index.js fieldChanged() when implementing this.
 *
 * @param {HTMLInputElement} input
 * @param {FileList} files
 */
function fileValidation(input, files) {
  const multiple = input.hasAttribute('multiple');
  const acceptedFile = (input.getAttribute('accept') || '').toLowerCase().split(',')
    .map((accept) => accept.trim()).filter(Boolean);
  const minItems = parseInt(input.dataset.minItems, 10) || 0;
  const maxItems = parseInt(input.dataset.maxItems ?? '-1', 10);
  const fileSize = `${input.dataset.maxFileSize || '2MB'}`;
  const wrapper = input.closest('.field-wrapper');
  const isRequired = input.required || wrapper.dataset.required === 'true';
  const errors = [];
  const addError = (constraint, invalidFiles, limit) => {
    let message = wrapper.dataset[`${constraint}ErrorMessage`]
      || wrapper.dataset[constraint]
      || defaultErrorMessages[constraint];
    if (limit !== undefined) {
      message = message.replace(/\$0/g, limit);
    }
    if (multiple && invalidFiles?.length) {
      message = `${message} ${invalidFiles.map((file) => file.name).join(', ')}`;
    }
    errors.push(message);
  };

  if (isRequired && files.length === 0) {
    addError('required');
  } else {
    const invalidTypes = acceptedFile.length
      ? files.filter((file) => !matchMediaType(file, acceptedFile)) : [];
    const oversizedFiles = files.filter((file) => file.size > getSizeInBytes(fileSize));
    if (invalidTypes.length) {
      addError('accept', invalidTypes);
    }
    if (oversizedFiles.length && (multiple || !errors.length)) {
      addError('maxFileSize', oversizedFiles, fileSize);
    }
    if (multiple && maxItems !== -1 && files.length > maxItems) {
      addError('maxItems', [], maxItems);
    } else if (multiple && files.length < minItems) {
      addError('minItems', [], minItems);
    }
  }
  const message = errors.join(' ');
  input.dataset.fileValidationMessage = message;
  input.setCustomValidity(message);
  updateOrCreateInvalidMsg(input, message);
}

function formatBytes(bytes) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['bytes', 'kb', 'mb', 'gb', 'tb', 'pb'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(0))} ${sizes[i]}`;
}

function updateButtonIndex(elements = []) {
  elements.forEach((element, index) => {
    element.dataset.index = index;
  });
}

function dispatchChangeEvent(input, files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => {
    dataTransfer.items.add(file instanceof File
      ? file : new File([file.data], file.name, { type: file.type || file.mediaType }));
  });
  input.files = dataTransfer.files;
  const options = { bubbles: true, detail: { files: [...files], deletion: true } };
  const changeEvent = new CustomEvent('change', options);
  input.dispatchEvent(changeEvent);
}

/**
 * creates an HTML element for the attached file
 * @param {File} file
 * @param {number} index
 */
function fileElement(file, index) {
  const el = document.createElement('div');
  el.dataset.index = index;
  el.classList.add('file-description');
  el.innerHTML = `<span class="file-description-name"></span>
  <span class="file-description-size">${formatBytes(file.size)}</span>
  <button class="file-description-remove" type="button"></button>`;
  el.querySelector('.file-description-name').textContent = file.name;
  return el;
}

/**
 * creates an HTML elements for drag & drop
 * @param {HTMLElement} wrapper
 */
function createDragAndDropArea(wrapper, field) {
  const input = wrapper.querySelector('input');
  const customButtonText = field?.properties?.['fd:buttonText'] || fileAttachmentText;
  const customDragDropText = field?.properties?.dragDropText || dragDropText;
  const dragArea = `
    <div class="file-dragIcon"></div>
    <div class="file-dragText">${customDragDropText}</div>
    <button class="file-attachButton" type="button">${customButtonText}</button>
  `;
  const dragContainer = document.createElement('div');
  if (input.title) {
    dragContainer.title = stripTags(input.title, '');
  }
  dragContainer.className = 'file-drag-area';
  dragContainer.innerHTML = dragArea;
  dragContainer.appendChild(input.cloneNode(true));
  input.parentNode.replaceChild(dragContainer, input);
  return dragContainer;
}

function createFileHandler(allFiles, input) {
  return {
    removeFile: (index) => {
      allFiles.splice(index, 1);
      const fileListElement = input.closest('.field-wrapper').querySelector('.files-list');
      fileListElement.querySelector(`[data-index="${index}"]`).remove();
      fileValidation(input, allFiles);
      updateButtonIndex(Array.from(fileListElement.children));
      dispatchChangeEvent(input, allFiles);
    },

    attachFiles: (inputEl, files) => {
      const multiple = inputEl.hasAttribute('multiple');
      let newFiles = Array.from(files || []);
      if (!newFiles.length) {
        return;
      }
      if (!multiple) {
        allFiles.splice(0, allFiles.length);
        newFiles = [newFiles[0]];
      }
      const currentLength = allFiles.length;
      allFiles.push(...newFiles);
      const newFileElements = newFiles
        .map((file, index) => fileElement(file, index + currentLength));
      const fileListElement = inputEl.closest('.field-wrapper').querySelector('.files-list');
      if (multiple) {
        fileListElement.append(...newFileElements);
      } else {
        fileListElement.replaceChildren(...newFileElements);
      }
      fileValidation(inputEl, allFiles);
      dispatchChangeEvent(input, allFiles);
    },

    previewFile: (index) => {
      const file = allFiles[index];
      let url = file.data || window.URL.createObjectURL(file);
      if (file.data) {
        const lastIndex = url.lastIndexOf('/');
        /* added check for query param since sas url contains query params &
          does not have file name, encoding is not required in this case
        */
        if (lastIndex >= 0 && url.indexOf('?') === -1) {
          // encode the filename after last slash to ensure the handling of special characters
          url = `${url.substr(0, lastIndex)}/${encodeURIComponent(url.substr(lastIndex + 1))}`;
        }
      }
      window.open(url, '', 'scrollbars=no,menubar=no,height=600,width=800,resizable=yes,toolbar=no,status=no');
    },
  };
}

// eslint-disable-next-line no-unused-vars
export default async function decorate(fieldDiv, field, htmlForm) {
  const allFiles = [];
  const dragArea = createDragAndDropArea(fieldDiv, field);
  const input = fieldDiv.querySelector('input');
  fieldDiv.classList.add('decorated');
  const fileListElement = document.createElement('div');
  fileListElement.classList.add('files-list');
  const attachButton = dragArea.querySelector('.file-attachButton');
  attachButton.addEventListener('click', () => input.click());
  const fileHandler = createFileHandler(allFiles, input);
  input.addEventListener('change', (event) => {
    if (!event?.detail?.deletion) {
      event.stopPropagation();
      fileHandler.attachFiles(input, event.target.files);
    }
  });
  dragArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dragArea.classList.remove('file-dragArea-active');
    fileHandler.attachFiles(input, (event?.dataTransfer?.files || []));
  });
  dragArea.addEventListener('paste', (event) => {
    event.preventDefault();
    fileHandler.attachFiles(input, (event?.clipboardData?.files || []));
  });
  dragArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dragArea.classList.add('file-dragArea-active');
  });
  dragArea.addEventListener('dragleave', () => {
    dragArea.classList.remove('file-dragArea-active');
  });
  fileListElement.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      fileHandler.removeFile(e.target?.parentElement?.dataset?.index || 0);
    } else if (e.target.tagName === 'SPAN') {
      fileHandler.previewFile(e.target?.parentElement?.dataset?.index || 0);
    }
  });
  fieldDiv.insertBefore(fileListElement, input.nextElementSibling);
  // pre-fill file attachment
  if (field.value) {
    const preFillFiles = Array.isArray(field.value) ? field.value : [field.value];
    fileHandler.attachFiles(input, preFillFiles);
  }
  return fieldDiv;
}
