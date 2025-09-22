/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * RadioCardComponent - A class-based implementation of a radio-card component extending Radio Group
 * This class encapsulates all the functionality for managing a form field's state,
 * view updates, and event handling.
 */
class RadioCardComponent {
  /**
   * Creates an instance of RadioCardComponent
   * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
   * @param {Object} fieldJson - The form json object for the component
   * @param {HTMLElement} parentElement - The parent element of the field
   * @param {string} formId - The unique identifier of the form
   */
  constructor(fieldDiv, fieldJson, parentElement, formId) {
    this.fieldDiv = fieldDiv;
    this.fieldJson = fieldJson;
    this.parentElement = parentElement;
    this.formId = formId;
    this.fieldModel = null;

    // Configuration properties
    this.propertyChanges = [];
    this.customEvent = '';
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // here you can listen to view changes and update the fieldModel
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      this.createCardLayout();
    }
  }

  /**
   * Creates the custom card layout for the radio group
   */
  createCardLayout() {
    // Clear existing content
    this.fieldDiv.innerHTML = '';

    // Get custom properties
    const questionText = this.fieldJson.properties?.questionText || 'Do you have a NZ driver licence?';
    const questionDescription = this.fieldJson.properties?.questionDescription || 'This will go in your new CV and help match you with jobs. If you don\'t have a licence, that\'s totally fine – many roles don\'t need it.';
    const noDescription = this.fieldJson.properties?.noOptionDescription || 'I don\'t have a driver licence';
    const yesDescription = this.fieldJson.properties?.yesOptionDescription || 'I have a driver licence';

    // Create the main container
    const container = document.createElement('div');
    container.className = 'radio-card-container';

    // Create question section
    const questionSection = document.createElement('div');
    questionSection.className = 'radio-card-question';
    
    const questionTitle = document.createElement('h2');
    questionTitle.className = 'radio-card-title';
    questionTitle.textContent = questionText;
    
    const questionDesc = document.createElement('p');
    questionDesc.className = 'radio-card-description';
    questionDesc.textContent = questionDescription;
    
    questionSection.appendChild(questionTitle);
    questionSection.appendChild(questionDesc);

    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'radio-card-options';

    // Create No option card
    const noCard = this.createOptionCard('no', 'No', noDescription, '🚫');
    const yesCard = this.createOptionCard('yes', 'Yes', yesDescription, '🚗');

    optionsContainer.appendChild(noCard);
    optionsContainer.appendChild(yesCard);

    container.appendChild(questionSection);
    container.appendChild(optionsContainer);
    this.fieldDiv.appendChild(container);

    // Add event listeners for card selection
    this.addCardEventListeners();
  }

  /**
   * Creates an individual option card
   */
  createOptionCard(value, label, description, icon) {
    const card = document.createElement('div');
    card.className = 'radio-card-option';
    card.setAttribute('data-value', value);

    const iconElement = document.createElement('div');
    iconElement.className = 'radio-card-icon';
    iconElement.textContent = icon;

    const labelElement = document.createElement('div');
    labelElement.className = 'radio-card-label';
    labelElement.textContent = label;

    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'radio-card-option-description';
    descriptionElement.textContent = description;

    const radioElement = document.createElement('div');
    radioElement.className = 'radio-card-radio';

    card.appendChild(iconElement);
    card.appendChild(labelElement);
    card.appendChild(descriptionElement);
    card.appendChild(radioElement);

    return card;
  }

  /**
   * Adds event listeners for card selection
   */
  addCardEventListeners() {
    const cards = this.fieldDiv.querySelectorAll('.radio-card-option');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const value = card.getAttribute('data-value');
        this.selectCard(value);
        this.updateFieldModel(value);
      });
    });
  }

  /**
   * Selects a card and updates visual state
   */
  selectCard(selectedValue) {
    const cards = this.fieldDiv.querySelectorAll('.radio-card-option');
    
    cards.forEach(card => {
      const value = card.getAttribute('data-value');
      if (value === selectedValue) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  /**
   * Updates the field model with the selected value
   */
  updateFieldModel(value) {
    if (this.fieldModel) {
      this.fieldModel.value = value;
    }
  }

  /**
   * Attaches event listeners to the form model
   * Listens to property changes and custom events and updates the view accordingly
   */
  attachEventListeners() {
    if (!this.fieldModel) {
      return;
    }

    // Listen for property changes
    this.fieldModel.subscribe((event) => {
      event?.payload?.changes?.forEach((change) => {
        if (this.propertyChanges.includes(change?.propertyName)) {
          this.updateView(this.fieldModel.getState());
        }
      });
    }, 'change');

    // Listen for custom events
    if (this.customEvent) {
      this.fieldModel.subscribe(() => {
        this.updateView(this.fieldModel.getState());
      }, this.customEvent);
    }
  }

  /**
   * Initializes the form field component
   * Sets up the initial view and subscribes to form model changes
   */
  async initialize() {
    // Update the view with initial data
    this.updateView(this.fieldJson);

    // Subscribe to form model changes
    subscribe(this.fieldDiv, this.formId, (element, model) => {
      this.fieldModel = model;
      this.attachEventListeners();
    });
  }
}

/**
 * Decorates a custom form field component
 * @param {HTMLElement} fieldDiv - The DOM element containing the field wrapper
 * @param {Object} fieldJson - The form json object for the component
 * @param {HTMLElement} parentElement - The parent element of the field
 * @param {string} formId - The unique identifier of the form
 */
export default async function decorate(fieldDiv, fieldJson, parentElement, formId) {
  const field = new RadioCardComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
