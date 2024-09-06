function decorateLink(link) {
  const checkbox = link.querySelector('input[type="checkbox"]');
  const label = link.querySelector('label');
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
  return link;
}

export default async function decorate(fieldDiv) {
  const links = fieldDiv.querySelectorAll('.checkbox-wrapper');
  links.forEach((link) => {
    decorateLink(link);
  });
  return fieldDiv;
}
