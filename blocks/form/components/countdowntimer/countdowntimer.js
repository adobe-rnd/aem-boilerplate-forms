/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * CountdowntimerComponent - A class-based implementation of a countdowntimer component
 * extending Number Input. This class encapsulates all the functionality for managing
 * a form field's state, view updates, and event handling.
 */
class CountdowntimerComponent {
  /**
   * Creates an instance of CountdowntimerComponent
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
    this.propertyChanges = ['value', 'visible', 'enabled'];
    this.customEvent = 'starttimerstoptimer';

    // Timer state
    this.timerInterval = null;
    // Default 35 seconds as shown in image
    this.initialTime = this.fieldJson?.properties?.timerDuration || 35;
    this.currentTime = this.initialTime;
    this.isRunning = false;
    this.timerElement = null;
    this.progressElement = null;
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // here you can listen to view changes and update the fieldModel
    // eslint-disable-next-line no-unused-vars
    const self = this;
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      this.createTimerView();
      this.updateTimerDisplay();
    }
  }

  /**
   * Creates the timer view with circular progress bar
   */
  createTimerView() {
    // Hide the default number input
    const inputElement = this.fieldDiv.querySelector('input[type="number"]');
    if (inputElement) {
      inputElement.style.display = 'none';
    }

    // Create timer container if it doesn't exist
    if (!this.timerElement) {
      this.timerElement = document.createElement('div');
      this.timerElement.className = 'countdown-timer-container';

      // Create circular progress container
      const progressContainer = document.createElement('div');
      progressContainer.className = 'countdown-progress-container';

      // Create SVG for circular progress
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'countdown-progress-svg');
      svg.setAttribute('viewBox', '0 0 200 200');

      // Create gradient definition
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', 'countdown-gradient');
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '100%');

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', '#ff0000');

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '25%');
      stop2.setAttribute('stop-color', '#ff6600');

      const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop3.setAttribute('offset', '50%');
      stop3.setAttribute('stop-color', '#ffaa00');

      const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop4.setAttribute('offset', '75%');
      stop4.setAttribute('stop-color', '#ffff00');

      const stop5 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop5.setAttribute('offset', '100%');
      stop5.setAttribute('stop-color', '#ffaa00');

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      gradient.appendChild(stop3);
      gradient.appendChild(stop4);
      gradient.appendChild(stop5);
      defs.appendChild(gradient);

      // Background circle
      const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bgCircle.setAttribute('cx', '100');
      bgCircle.setAttribute('cy', '100');
      bgCircle.setAttribute('r', '90');
      bgCircle.setAttribute('class', 'countdown-bg-circle');

      // Progress circle
      this.progressElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      this.progressElement.setAttribute('cx', '100');
      this.progressElement.setAttribute('cy', '100');
      this.progressElement.setAttribute('r', '90');
      this.progressElement.setAttribute('class', 'countdown-progress-circle');
      this.progressElement.setAttribute('stroke-dasharray', '565.48');
      this.progressElement.setAttribute('stroke-dashoffset', '0');

      svg.appendChild(defs);
      svg.appendChild(bgCircle);
      svg.appendChild(this.progressElement);

      // Timer display
      const timerDisplay = document.createElement('div');
      timerDisplay.className = 'countdown-timer-display';

      const timeNumber = document.createElement('div');
      timeNumber.className = 'countdown-time-number';
      timeNumber.textContent = this.currentTime;

      const timeLabel = document.createElement('div');
      timeLabel.className = 'countdown-time-label';
      timeLabel.textContent = 'SECONDS';

      timerDisplay.appendChild(timeNumber);
      timerDisplay.appendChild(timeLabel);

      progressContainer.appendChild(svg);
      progressContainer.appendChild(timerDisplay);
      this.timerElement.appendChild(progressContainer);

      // Insert after the label
      const labelElement = this.fieldDiv.querySelector('.cmp-form-text__label');
      if (labelElement) {
        labelElement.parentNode.insertBefore(this.timerElement, labelElement.nextSibling);
      } else {
        this.fieldDiv.appendChild(this.timerElement);
      }
    }
  }

  /**
   * Updates the timer display and progress
   */
  updateTimerDisplay() {
    if (!this.timerElement) return;

    const timeNumber = this.timerElement.querySelector('.countdown-time-number');
    if (timeNumber) {
      timeNumber.textContent = this.currentTime;
    }

    // Update progress circle
    if (this.progressElement) {
      const circumference = 2 * Math.PI * 90; // radius = 90
      const progress = (this.initialTime - this.currentTime) / this.initialTime;
      const offset = circumference * (1 - progress);
      this.progressElement.setAttribute('stroke-dashoffset', offset);
    }

    // Update field model value with remaining time
    if (this.fieldModel) {
      this.fieldModel.value = this.currentTime;
    }
  }

  /**
   * Starts the countdown timer
   */
  startTimer() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.timerInterval = setInterval(() => {
      if (this.currentTime > 0) {
        this.currentTime -= 1;
        this.updateTimerDisplay();
      } else {
        this.stopTimer();
      }
    }, 1000);
  }

  /**
   * Stops the countdown timer and captures the value
   */
  stopTimer() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Capture the remaining time as the field value
    if (this.fieldModel) {
      this.fieldModel.value = this.currentTime;
    }
  }

  /**
   * Resets the timer to initial state
   */
  resetTimer() {
    this.stopTimer();
    this.currentTime = this.initialTime;
    this.updateTimerDisplay();
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

    // Listen for startTimer event
    this.fieldModel.subscribe(() => {
      this.startTimer();
    }, 'startTimer');

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
  const field = new CountdowntimerComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
