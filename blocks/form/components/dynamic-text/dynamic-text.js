import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  // Get the text content and configuration from the field definition
  const {
    text = '',
    enableRichText = false,
    emptyTextMessage = 'No text template provided',
    updateEvent = 'updateText',
  } = fd?.properties || {};

  // Add custom class for styling
  element.classList.add('dynamic-text-wrapper');

  // Find the text element (could be p, div, span, etc.)
  const textElement = element.querySelector('p, div, span') || element;

  // Function to substitute properties in text
  function substituteProperties(textContent, properties) {
    if (!textContent || !properties) return textContent;

    let result = textContent;

    // Replace placeholders in the format {{propertyName}} with actual values
    Object.keys(properties).forEach((propName) => {
      const placeholderPattern = `{{${propName}}}`;
      const value = properties[propName];

      // Convert value to string and handle different data types
      let stringValue = '';
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }
      }

      // Escape special regex characters in placeholder
      const escapedPlaceholder = placeholderPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), stringValue);
    });

    return result;
  }

  // Function to update the text content
  function updateTextContent(properties) {
    if (!text || text.trim() === '') {
      textElement.textContent = emptyTextMessage;
      element.classList.add('empty-text');
      return;
    }

    element.classList.remove('empty-text');
    const substitutedText = substituteProperties(text, properties);

    if (enableRichText) {
      textElement.innerHTML = substitutedText;
    } else {
      textElement.textContent = substitutedText;
    }
  }

  // Subscribe to field changes to update text when properties change
  subscribe(element, formId, (_fieldDiv, fieldModel) => {
    // Initial text update with current properties
    updateTextContent(fieldModel.properties);

    // Listen for property changes
    fieldModel.subscribe((event) => {
      const { changes } = event.payload;

      changes.forEach((change) => {
        // Check if any property changed
        if (change.propertyName === 'properties') {
          updateTextContent(change.currentValue);
        }
      });
    }, 'change');

    // Listen for custom events that might update properties
    fieldModel.subscribe(() => {
      // Update text when custom events are triggered
      updateTextContent(fieldModel.properties);
    }, updateEvent);

    // Listen for text template changes
    fieldModel.subscribe((event) => {
      const { changes } = event.payload;

      changes.forEach((change) => {
        if (change.propertyName === 'text') {
          updateTextContent(fieldModel.properties);
        }
      });
    }, 'change');
  });

  // Set initial text content
  updateTextContent(fd.properties || {});
}
