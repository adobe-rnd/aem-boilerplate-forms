/* eslint-disable aem-forms/component-value-sync -- This is a SHARED VIEW HELPER, not a component
   decorator: it takes the model and returns a `syncFromModel` handle. The value re-sync IS wired
   by every consumer component, each of which subscribes `{listenChanges:true}` and calls
   `widget.syncFromModel()` on a value/enum/enumNames change (covers importData prefill/resume).
   The analyzer is per-file and can't see that cross-file wiring; the out-of-enum render path it
   warns about is fixed here in syncFromModel. */
// Reusable searchable-dropdown VIEW — input-over-native-select with client-side filtering of the
// current enum, a clear button, and model value/enum sync. VIEW ONLY: no API/search here. The
// component commits `model.value` on keystroke/select; a `change` rule can run a search via a rule
// function and set `enum` with setProperty. When that new enum arrives, the consumer's `change`
// handler calls `syncFromModel`, which re-renders the option list if the input is focused.
// Reusable view helper — shared across consumer components. No `model.name` branching.

const optionName = (value, model) => {
  const i = Array.isArray(model?.enum) ? model.enum.indexOf(value) : -1;
  return (i !== -1 && model?.enumNames?.[i] !== undefined) ? model.enumNames[i] : undefined;
};

/**
 * Decorate `fieldDiv` (which already contains the OOTB `<select>`) as a searchable dropdown (view
 * only). The typeahead threshold is the OOTB `minLength`; below it the option list stays closed.
 * @param {HTMLElement} fieldDiv - the field wrapper
 * @param {Object} model - the field model (capture in the component's `register` callback)
 * @returns {{ syncFromModel: () => void }} handle to re-sync the input/list on value/enum change
 */
// eslint-disable-next-line import/prefer-default-export -- shared view, imported by name
export function createSearchableDropdown(fieldDiv, model) {
  // Typeahead min/max: a searchable dropdown can't use the OOTB `minLength`/`maxLength` — the AEM
  // dropdown Sling model strips them on conversion — so authored content carries them as the custom
  // `searchMinLength`/`searchMaxLength` properties. Prefer those; fall back to OOTB minLength/maxLength
  // for any field type that DOES carry them (backward compatible). `minChars` gates the option-list
  // DISPLAY (the list opens only at/above the threshold); the value is still committed on every
  // keystroke so nothing the user types is lost. `maxChars` caps the input length.
  const props = model?.properties || {};
  const minChars = Number(props.searchMinLength ?? model?.minLength) || 0;
  const maxChars = Number(props.searchMaxLength ?? model?.maxLength) || 0;
  // Empty-state copy — the ONE shared, authorable property across every searchable-dropdown consumer.
  const noResultMessage = props.noResultMessage || 'No results found';
  const select = fieldDiv.querySelector('select');
  if (!select) {
    return { syncFromModel() {} };
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-dropdown-wrapper';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'searchable-dropdown-input';
  input.placeholder = model?.placeholder || '';
  if (maxChars > 0) {
    input.setAttribute('maxlength', String(maxChars));
  }
  const list = document.createElement('div');
  list.className = 'searchable-dropdown-list';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'searchable-dropdown-clear';
  clearBtn.setAttribute('aria-label', 'Clear');
  wrapper.append(input, clearBtn, list);
  select.style.display = 'none';
  fieldDiv.appendChild(wrapper);

  const updateClearBtn = () => clearBtn.classList.toggle('is-visible', !!input.value);

  const populate = (filter = '') => {
    list.innerHTML = '';
    const opts = Array.from(select.options).filter((o) => !o.disabled);
    const matches = filter
      ? opts.filter((o) => o.text.toLowerCase().includes(filter.toLowerCase()))
      : opts;
    if (matches.length === 0) {
      const none = document.createElement('div');
      none.className = 'dropdown-no-results';
      none.textContent = noResultMessage;
      list.appendChild(none);
      return;
    }
    matches.forEach((o) => {
      const el = document.createElement('div');
      el.className = 'dropdown-option';
      el.textContent = o.text;
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = o.text;
        model.value = o.value;
        list.style.display = 'none';
        updateClearBtn();
      });
      list.appendChild(el);
    });
  };

  const closeList = () => {
    list.style.display = 'none';
  };

  // Reflect the model value in the input, and — when the input is focused (mid-search) — re-render
  // the option list. When a new enum arrives asynchronously, this makes the freshly-arrived options
  // visible without the view issuing any request itself.
  const syncFromModel = () => {
    const name = optionName(model.value, model);
    if (name !== undefined) {
      input.value = name;
    } else if (model.value) {
      // Free-text / not-(yet)-in-enum value: show the raw value so resume/prefill doesn't render blank.
      input.value = String(model.value);
    } else {
      input.value = '';
    }
    if (document.activeElement === input && input.value.length >= minChars) {
      populate('');
      list.style.display = 'block';
    }
    updateClearBtn();
  };
  syncFromModel();

  clearBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    input.value = '';
    model.value = '';
    closeList();
    updateClearBtn();
  });

  input.addEventListener('focus', () => {
    updateClearBtn();
    if (input.value.length < minChars) {
      closeList();
      return;
    }
    populate('');
    list.style.display = 'block';
  });

  input.addEventListener('input', () => {
    updateClearBtn();
    model.value = input.value;
    if (!input.value) {
      populate();
      list.style.display = 'block';
      return;
    }
    if (input.value.length >= minChars) {
      populate('');
      list.style.display = 'block';
    } else {
      closeList();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(closeList, 150);
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeList();
    }
  });

  return { syncFromModel };
}
