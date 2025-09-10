import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  // Access enum and enumNames properties
  const enumValues = fd?.enum || [];
  const enumNames = fd?.enumNames || [];
  
  // Add custom class for styling
  element.classList.add('card-choice-wrapper');
  
  // Clear the default radio group content
  element.innerHTML = '';
  
  // Create the fieldset structure
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'card-choice-fieldset';
  
  // Create legend
  const legend = document.createElement('legend');
  legend.className = 'field-label';
  legend.textContent = fd?.label?.value || 'Choose an option';
  fieldset.appendChild(legend);
  
  // Create cards container
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'card-choice-cards';
  
  // Create cards for each enum option
  enumValues.forEach((enumValue, index) => {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'card-choice-card';
    
    // Create radio input (hidden)
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = `${fd?.id || 'card-choice'}-${index}`;
    radioInput.name = fd?.name || 'card-choice';
    radioInput.value = typeof enumValue === 'object' ? enumValue.name : enumValue;
    radioInput.className = 'card-choice-input';
    
    // Create card label
    const cardLabel = document.createElement('label');
    cardLabel.htmlFor = radioInput.id;
    cardLabel.className = 'card-choice-label';
    
    // Create card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-choice-content';
    
    // Get card data from enum object or use enumNames
    let title, description, imageUrl, benefits;
    if (typeof enumValue === 'object') {
      title = enumValue.name || enumNames[index] || `Option ${index + 1}`;
      description = enumValue.description || '';
      imageUrl = enumValue.image || `https://via.placeholder.com/200x150/4CAF50/FFFFFF?text=Card+${index + 1}`;
      benefits = enumValue.benefits || '';
    } else {
      title = enumNames[index] || enumValue || `Option ${index + 1}`;
      description = '';
      imageUrl = `https://via.placeholder.com/200x150/4CAF50/FFFFFF?text=Card+${index + 1}`;
      benefits = '';
    }
    
    // Create image
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = title;
    image.className = 'card-choice-image';
    
    // Create title
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.className = 'card-choice-title';
    
    // Create description
    const descriptionElement = document.createElement('p');
    descriptionElement.textContent = description;
    descriptionElement.className = 'card-choice-description';
    
    // Create benefits
    const benefitsElement = document.createElement('div');
    benefitsElement.textContent = benefits;
    benefitsElement.className = 'card-choice-benefits';
    
    // Assemble card
    cardContent.appendChild(image);
    cardContent.appendChild(titleElement);
    if (description) cardContent.appendChild(descriptionElement);
    if (benefits) cardContent.appendChild(benefitsElement);
    cardLabel.appendChild(cardContent);
    
    cardWrapper.appendChild(radioInput);
    cardWrapper.appendChild(cardLabel);
    cardsContainer.appendChild(cardWrapper);
    
    // Add click handler for card selection
    cardLabel.addEventListener('click', (e) => {
      e.preventDefault();
      // Uncheck all other radios
      cardsContainer.querySelectorAll('.card-choice-input').forEach(input => {
        input.checked = false;
        input.closest('.card-choice-card').classList.remove('selected');
      });
      
      // Check this radio and mark card as selected
      radioInput.checked = true;
      cardWrapper.classList.add('selected');
      
      // Trigger change event for form validation
      radioInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  
  fieldset.appendChild(cardsContainer);
  
  // Add description/error message container
  const description = document.createElement('div');
  description.className = 'field-description';
  description.id = `${fd?.id || 'card-choice'}-description`;
  if (fd?.description) {
    description.textContent = fd.description;
  }
  fieldset.appendChild(description);
  
  element.appendChild(fieldset);
  
  // Subscribe to field changes for dynamic updates
  subscribe(element, formId, (_fieldDiv, fieldModel) => {
    // Listen for enum changes (when options are updated)
    fieldModel.subscribe((event) => {
      const changes = event.payload.changes;
      changes.forEach(change => {
        if (change.propertyName === 'enum' || change.propertyName === 'enumNames') {
          // Re-render cards if options change
          const newEnumValues = fieldModel.enum || [];
          const newEnumNames = fieldModel.enumNames || [];
          if (newEnumValues.length > 0) {
            // Update the cards with new options
            updateCards(cardsContainer, newEnumValues, newEnumNames, fd, fieldModel);
          }
        }
      });
    }, 'change');
  });
}

function updateCards(cardsContainer, enumValues, enumNames, fd, fieldModel) {
  // Clear existing cards
  cardsContainer.innerHTML = '';
  
  // Create new cards
  enumValues.forEach((enumValue, index) => {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'card-choice-card';
    
    // Create radio input (hidden)
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = `${fd?.id || 'card-choice'}-${index}`;
    radioInput.name = fd?.name || 'card-choice';
    radioInput.value = typeof enumValue === 'object' ? enumValue.name : enumValue;
    radioInput.className = 'card-choice-input';
    
    // Create card label
    const cardLabel = document.createElement('label');
    cardLabel.htmlFor = radioInput.id;
    cardLabel.className = 'card-choice-label';
    
    // Create card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-choice-content';
    
    // Get card data from enum object or use enumNames
    let title, description, imageUrl, benefits;
    if (typeof enumValue === 'object') {
      title = enumValue.name || enumNames[index] || `Option ${index + 1}`;
      description = enumValue.description || '';
      imageUrl = enumValue.image || `https://via.placeholder.com/200x150/4CAF50/FFFFFF?text=Card+${index + 1}`;
      benefits = enumValue.benefits || '';
    } else {
      title = enumNames[index] || enumValue || `Option ${index + 1}`;
      description = '';
      imageUrl = `https://via.placeholder.com/200x150/4CAF50/FFFFFF?text=Card+${index + 1}`;
      benefits = '';
    }
    
    // Create image
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = title;
    image.className = 'card-choice-image';
    
    // Create title
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.className = 'card-choice-title';
    
    // Create description
    const descriptionElement = document.createElement('p');
    descriptionElement.textContent = description;
    descriptionElement.className = 'card-choice-description';
    
    // Create benefits
    const benefitsElement = document.createElement('div');
    benefitsElement.textContent = benefits;
    benefitsElement.className = 'card-choice-benefits';
    
    // Assemble card
    cardContent.appendChild(image);
    cardContent.appendChild(titleElement);
    if (description) cardContent.appendChild(descriptionElement);
    if (benefits) cardContent.appendChild(benefitsElement);
    cardLabel.appendChild(cardContent);
    
    cardWrapper.appendChild(radioInput);
    cardWrapper.appendChild(cardLabel);
    cardsContainer.appendChild(cardWrapper);
    
    // Add click handler for card selection
    cardLabel.addEventListener('click', (e) => {
      e.preventDefault();
      // Uncheck all other radios
      cardsContainer.querySelectorAll('.card-choice-input').forEach(input => {
        input.checked = false;
        input.closest('.card-choice-card').classList.remove('selected');
      });
      
      // Check this radio and mark card as selected
      radioInput.checked = true;
      cardWrapper.classList.add('selected');
      
      // Update field model value
      fieldModel.value = typeof enumValue === 'object' ? enumValue.name : enumValue;
      
      // Trigger change event for form validation
      radioInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}