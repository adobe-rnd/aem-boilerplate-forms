function parseImageUrls(urls) {
  if (Array.isArray(urls)) return urls.map((u) => String(u).trim());
  if (typeof urls === 'string') return urls.split(/[\n,]/).map((u) => u.trim());
  return [];
}

export default function decorate(fieldDiv, fieldJson) {
  const props = fieldJson?.properties || {};
  const isSingle = props.selectionMode !== 'multiple';
  const showLabels = props.showLabels === true || props.showLabels === 'true';
  const images = parseImageUrls(props.imageUrls);

  const sizeClasses = { small: 'image-choice-small', large: 'image-choice-large' };
  fieldDiv.classList.add('image-choice');
  if (sizeClasses[props.imageSize]) fieldDiv.classList.add(sizeClasses[props.imageSize]);
  fieldDiv.dataset.selectionMode = isSingle ? 'single' : 'multiple';

  // Core rebuilds the options on enum changes, so enhancement must be idempotent.
  const enhance = () => {
    fieldDiv.querySelectorAll(':scope > .checkbox-wrapper').forEach((option, index) => {
      if (option.dataset.imageChoiceOption) return;
      const label = option.querySelector('label');
      if (!label) return;
      const text = label.textContent.trim();
      const text$ = document.createElement('span');
      text$.className = showLabels ? 'image-choice-label' : 'image-choice-label visually-hidden';
      text$.textContent = text;
      label.replaceChildren(text$);
      if (images[index]) {
        const img = document.createElement('img');
        img.src = images[index];
        img.alt = text;
        img.loading = 'lazy';
        img.className = 'image-choice-image';
        label.prepend(img);
      }
      option.dataset.imageChoiceOption = 'true';
      option.classList.add('image-choice-option');
    });
  };

  enhance();
  new MutationObserver(enhance).observe(fieldDiv, { childList: true });

  // Runs before the form-level handler so the group value is computed from the final state.
  fieldDiv.addEventListener('change', (e) => {
    const input = e.target;
    if (!isSingle || input.type !== 'checkbox' || !input.checked) return;
    fieldDiv.querySelectorAll('input[type="checkbox"]').forEach((other) => {
      if (other !== input) other.checked = false;
    });
  });

  return fieldDiv;
}
