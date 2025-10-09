/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * CountdownTimerComponent - A class-based implementation of a countdown-timer component
 * extending Number Input. This class encapsulates all the functionality for managing
 * a form field's state, view updates, and event handling.
 */
class CountdownTimerComponent {
  /**
   * Creates an instance of CountdownTimerComponent
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
    this.propertyChanges = ['value'];
    this.customEvent = 'starttimerstoptimer';

    // Timer state
    this.timerInterval = null;
    this.initialValue = 0;
    this.currentValue = 0;
    this.isRunning = false;
    this.timerContainer = null;
    this.progressCircle = null;
    this.timeDisplay = null;
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Update the field model with the current timer value when stopped
    if (this.fieldModel && !this.isRunning) {
      this.fieldModel.value = this.currentValue;
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      // Initialize timer display if not already created
      if (!this.timerContainer) {
        this.createTimerDisplay();
      }

      // Update the display with current value
      this.updateTimerDisplay();
    }
  }

  /**
   * Creates the countdown timer display with circular progress bar
   */
  createTimerDisplay() {
    // Hide the default input field
    const inputElement = this.fieldDiv.querySelector('input');
    if (inputElement) {
      inputElement.style.display = 'none';
    }

    // Create timer container
    this.timerContainer = document.createElement('div');
    this.timerContainer.className = 'countdown-timer-container';

    // Create circular progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'countdown-progress-container';

    // Create SVG for circular progress
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'countdown-progress-svg';
    svg.setAttribute('viewBox', '0 0 200 200');

    // Create defs for gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', 'countdown-gradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');

    // Add gradient stops
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

    linearGradient.appendChild(stop1);
    linearGradient.appendChild(stop2);
    linearGradient.appendChild(stop3);
    linearGradient.appendChild(stop4);
    linearGradient.appendChild(stop5);
    defs.appendChild(linearGradient);

    // Create background circle
    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', '100');
    backgroundCircle.setAttribute('cy', '100');
    backgroundCircle.setAttribute('r', '90');
    backgroundCircle.className = 'countdown-background-circle';

    // Create progress circle
    this.progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.progressCircle.setAttribute('cx', '100');
    this.progressCircle.setAttribute('cy', '100');
    this.progressCircle.setAttribute('r', '90');
    this.progressCircle.className = 'countdown-progress-circle';
    this.progressCircle.setAttribute('stroke-dasharray', '565.48'); // 2 * π * 90
    this.progressCircle.setAttribute('stroke-dashoffset', '0');

    svg.appendChild(defs);
    svg.appendChild(backgroundCircle);
    svg.appendChild(this.progressCircle);

    // Create time display
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'countdown-time-display';

    progressContainer.appendChild(svg);
    progressContainer.appendChild(this.timeDisplay);
    this.timerContainer.appendChild(progressContainer);

    // Add to field div
    this.fieldDiv.appendChild(this.timerContainer);
  }

  /**
   * Updates the timer display with current values
   */
  updateTimerDisplay() {
    if (!this.timeDisplay || !this.progressCircle) return;

    // Update time display
    this.timeDisplay.innerHTML = `
      <div class="countdown-number">${this.currentValue}</div>
      <div class="countdown-label">SECONDS</div>
    `;

    // Update progress circle
    const circumference = 2 * Math.PI * 90; // radius = 90
    const progress = this.initialValue > 0 ? (this.currentValue / this.initialValue) : 0;
    const offset = circumference - (progress * circumference);

    this.progressCircle.setAttribute('stroke-dashoffset', offset);
  }

  /**
   * Starts the countdown timer
   */
  startTimer() {
    if (this.isRunning) return;

    // Get initial value from field model or default
    this.initialValue = this.fieldModel?.value || this.fieldJson?.default || 60;
    this.currentValue = this.initialValue;

    this.isRunning = true;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (this.currentValue > 0) {
        this.currentValue -= 1;
        this.updateTimerDisplay();
      } else {
        this.stopTimer();
      }
    }, 1000);
  }

  /**
   * Stops the countdown timer
   */
  stopTimer() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Update the field model with the stopped value
    this.updateModel();
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

    // Listen for custom events - startTimer and stopTimer
    this.fieldModel.subscribe((event) => {
      const eventName = event?.payload?.eventName;
      if (eventName === 'startTimer') {
        this.startTimer();
      } else if (eventName === 'stopTimer') {
        this.stopTimer();
      }
    }, 'startTimer');

    this.fieldModel.subscribe((event) => {
      const eventName = event?.payload?.eventName;
      if (eventName === 'startTimer') {
        this.startTimer();
      } else if (eventName === 'stopTimer') {
        this.stopTimer();
      }
    }, 'stopTimer');
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
  const field = new CountdownTimerComponent(fieldDiv, fieldJson, parentElement, formId);
  await field.initialize();
}
