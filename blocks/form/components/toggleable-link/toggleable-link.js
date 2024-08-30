function decorateTncLink(tncLink) {
  const checkbox = tncLink.querySelector('input[type="checkbox"]');
  const label = tncLink.querySelector('label');
  const { value } = checkbox;
  const labelText = label.textContent;
  label.textContent = '';

  const newAnchor = document.createElement('a');
  newAnchor.title = labelText;
  newAnchor.href = value;
  newAnchor.target = '_blank';

  const newSpan = document.createElement('span');
  newSpan.textContent = labelText;

  checkbox.style.display = 'none';
  newAnchor.appendChild(newSpan);
  label.appendChild(checkbox);
  label.appendChild(newAnchor);

  label.addEventListener('click', () => {
    checkbox.click();
  });
  return tncLink;
}

export default async function decorate(fieldDiv) {
  const tncLinks = fieldDiv.querySelectorAll('.checkbox-wrapper');
  tncLinks.forEach((tncLink) => {
    decorateTncLink(tncLink);
  });
  return fieldDiv;
}
