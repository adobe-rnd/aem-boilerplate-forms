/* eslint-env mocha */
import assert from 'assert';
import { generateFormRendition } from '../../blocks/form/form.js';
import { fieldChanged } from '../../blocks/form/rules/index.js';

describe('File attachments', () => {
  let form;
  let input;
  let wrapper;
  let changes;
  let previousHlx;

  beforeEach(() => {
    previousHlx = window.hlx;
  });

  afterEach(() => {
    window.hlx = previousHlx;
  });

  async function render(overrides = {}) {
    form = document.createElement('form');
    window.hlx = { codeBasePath: '../..' };
    await generateFormRendition({
      items: [{
        id: 'attachments',
        name: 'attachments',
        fieldType: 'file-input',
        type: 'file[]',
        label: { value: 'Attachments' },
        ...overrides,
      }],
    }, form, 'attachment-tests');
    input = form.querySelector('input');
    wrapper = input.closest('.field-wrapper');
    changes = [];
    form.addEventListener('change', (event) => changes.push(event.detail.files));
  }

  function attach(files, eventType = 'change') {
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    if (eventType === 'change') {
      input.files = files;
      input.dispatchEvent(event);
    } else {
      const property = eventType === 'paste' ? 'clipboardData' : 'dataTransfer';
      Object.defineProperty(event, property, { value: { files } });
      wrapper.querySelector('.file-drag-area').dispatchEvent(event);
    }
  }

  function file(name, size = 10, type = 'application/pdf') {
    return new File([new ArrayBuffer(size)], name, { type });
  }

  function names() {
    return [...wrapper.querySelectorAll('.file-description-name')].map((el) => el.textContent);
  }

  it('keeps selected, dropped, and pasted files in the input and change payload after removal', async () => {
    await render({ required: true });
    attach([file('one.pdf'), file('two.pdf')]);
    attach([file('three.pdf')], 'drop');
    attach([file('four.pdf')], 'paste');
    wrapper.querySelectorAll('.file-description-remove')[1].click();
    assert.deepStrictEqual(names(), ['one.pdf', 'three.pdf', 'four.pdf']);
    assert.deepStrictEqual(Array.from(input.files, (item) => item.name), names());
    assert.deepStrictEqual(changes.at(-1).map((item) => item.name), names());
    assert.strictEqual(changes[0].length, 2, 'Earlier event payloads must not mutate');
    assert.strictEqual(input.validity.customError, false);
  });

  it('preserves attachments when selection is cancelled or non-file content is pasted', async () => {
    await render({ type: 'file' });
    attach([file('one.pdf')]);
    attach([]);
    attach([], 'paste');
    assert.deepStrictEqual(names(), ['one.pdf']);
    assert.strictEqual(changes.length, 1);
  });

  it('lists all type and size failures with comma-separated filenames and author messages', async () => {
    await render({
      accept: ['application/pdf'],
      maxFileSize: '1KB',
      constraintMessages: { accept: 'Use PDF files.', maxFileSize: 'Files must be under 1 KB.' },
    });
    attach([
      file('wrong.png', 10, 'image/png'),
      file('wrong.txt', 10, 'text/plain'),
      file('large.pdf', 2048),
      file('larger.pdf', 4096),
      file('valid.pdf'),
    ]);
    assert.strictEqual(
      input.validationMessage,
      'Use PDF files. wrong.png, wrong.txt Files must be under 1 KB. large.pdf, larger.pdf',
    );
    assert.strictEqual(wrapper.querySelector('.field-description').textContent, input.validationMessage);
    assert.strictEqual(form.checkValidity(), false);
    assert.deepStrictEqual(changes[0].map((item) => item.name), names());
  });

  it('uses custom type and size messages for single-file fields', async () => {
    await render({
      type: 'file',
      accept: ['application/pdf'],
      maxFileSize: '1KB',
      constraintMessages: { accept: 'Use a PDF.', maxFileSize: 'File must be under 1 KB.' },
    });
    attach([file('large.pdf', 2048)]);
    assert.strictEqual(input.validationMessage, 'File must be under 1 KB.');
    attach([file('wrong.png', 10, 'image/png')]);
    assert.strictEqual(input.validationMessage, 'Use a PDF.');
    attach([file('valid.pdf')]);
    assert.strictEqual(input.validationMessage, '');
  });

  it('preserves media-type matching without using filenames to accept files', async () => {
    await render({ accept: ['application/pdf', 'image/*'] });
    attach([
      file('document.txt', 10, 'application/pdf'),
      file('photo.bin', 10, 'image/png'),
      file('unknown.bin', 10, ''),
    ]);
    assert.strictEqual(input.validationMessage, '');
    attach([file('misleading.pdf', 10, 'text/plain')]);
    assert.strictEqual(
      input.validationMessage,
      'The specified file type not supported. misleading.pdf',
    );
    await render({ accept: ['.pdf'] });
    attach([file('document.bin', 10, 'application/pdf')]);
    assert.strictEqual(input.validationMessage, '');
    await render();
    attach([file('unknown.custom', 10, '')]);
    assert.strictEqual(input.validationMessage, '');
  });

  it('honors configured minimum and maximum counts and clears errors after removal', async () => {
    await render({
      minItems: 2,
      maxItems: 3,
      constraintMessages: { minItems: 'Attach at least two files.', maxItems: 'Attach no more than three files.' },
    });
    attach([file('one.pdf')]);
    assert.strictEqual(input.validationMessage, 'Attach at least two files.');
    attach([file('two.pdf'), file('three.pdf')]);
    assert.strictEqual(input.validationMessage, '');
    attach([file('four.pdf')]);
    assert.strictEqual(input.validationMessage, 'Attach no more than three files.');
    wrapper.querySelector('.file-description-remove').click();
    assert.strictEqual(input.validationMessage, '');
    assert.strictEqual(wrapper.classList.contains('field-invalid'), false);
  });

  it('enforces required and minimum-one constraints after the last file is removed', async () => {
    await render({ required: true, minItems: 1, constraintMessages: { required: 'Attach a file.' } });
    attach([file('one.pdf')], 'drop');
    wrapper.querySelector('.file-description-remove').click();
    assert.strictEqual(input.validationMessage, 'Attach a file.');
    assert.strictEqual(input.files.length, 0);
    await render({ minItems: 1 });
    attach([file('one.pdf')]);
    wrapper.querySelector('.file-description-remove').click();
    assert.strictEqual(input.validationMessage, 'Specify a number of items equal to or greater than 1.');
  });

  it('does not treat optional fields as required and preserves single-file replacement', async () => {
    await render({
      type: 'file', required: false, minItems: 2, maxItems: 2,
    });
    attach([file('one.pdf'), file('two.pdf')]);
    assert.deepStrictEqual(names(), ['one.pdf']);
    attach([file('replacement.pdf')]);
    assert.deepStrictEqual(names(), ['replacement.pdf']);
    wrapper.querySelector('.file-description-remove').click();
    assert.strictEqual(input.validationMessage, '');
  });

  it('prefills every attachment from model file objects and renders filenames as text', async () => {
    const name = '<img src=x onerror=alert(1)>.pdf';
    await render({
      value: [
        {
          name, mediaType: 'application/pdf', size: 10, data: '/one.pdf',
        },
        {
          name: 'two.pdf', mediaType: 'application/pdf', size: 10, data: '/two.pdf',
        },
      ],
      accept: ['application/pdf'],
    });
    assert.deepStrictEqual(names(), [name, 'two.pdf']);
    assert.strictEqual(input.files.length, 2);
    assert.strictEqual(input.files[0].type, 'application/pdf');
    assert.strictEqual(input.validationMessage, '');
    assert.strictEqual(wrapper.querySelector('.files-list img'), null);
  });

  it('preserves file-specific errors when model validity changes and clears them after correction', async () => {
    await render({ accept: ['application/pdf'] });
    attach([file('one.png', 10, 'image/png'), file('two.png', 10, 'image/png')]);
    const message = 'The specified file type not supported. one.png, two.png';
    await fieldChanged({
      field: {
        id: input.id,
        fieldType: 'file-input',
        validity: { valid: false, acceptMismatch: true },
        validationMessage: 'Worker file type error',
      },
      changes: [
        { propertyName: 'valid', currentValue: false },
        { propertyName: 'validationMessage', currentValue: 'Worker file type error' },
      ],
    }, form);
    assert.strictEqual(input.validationMessage, message);
    await fieldChanged({
      field: { id: input.id, fieldType: 'file-input', validity: { valid: true } },
      changes: [{ propertyName: 'valid', currentValue: true }],
    }, form);
    assert.strictEqual(input.validationMessage, message);
    wrapper.querySelector('.file-description-remove').click();
    wrapper.querySelector('.file-description-remove').click();
    attach([file('valid.pdf')]);
    assert.strictEqual(input.validationMessage, '');
    assert.strictEqual(form.checkValidity(), true);
  });
});
