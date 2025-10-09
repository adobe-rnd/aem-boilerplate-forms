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

    // Timer state
    this.timerInterval = null;
    this.initialValue = 0;
    this.currentValue = 0;
    this.isRunning = false;

    // Configuration properties
    this.propertyChanges = ['value'];
    this.customEvents = ['startTimer', 'stopTimer'];
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Update the field model with the current timer value
    if (this.fieldModel) {
      this.fieldModel.value = this.currentValue;
    }
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      // Initialize timer display
      this.createTimerDisplay();
      // Set initial value if provided
      if (state.default !== undefined) {
        this.initialValue = parseInt(state.default, 10) || 0;
        this.currentValue = this.initialValue;
        this.updateTimerDisplay();
      }
    }
  }

  /**
   * Creates the countdown timer display with circular progress
   */
  createTimerDisplay() {
    // Find the input element and hide it
    const input = this.fieldDiv.querySelector('input[type="number"]');
    if (input) {
      input.style.display = 'none';
    }

    // Create timer container
    let timerContainer = this.fieldDiv.querySelector('.countdown-timer-container');
    if (!timerContainer) {
      timerContainer = document.createElement('div');
      timerContainer.className = 'countdown-timer-container';
      this.fieldDiv.appendChild(timerContainer);
    }

    // Create circular progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'countdown-progress-container';

    // Create SVG for circular progress
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.className = 'countdown-svg';

    // Create defs for gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'countdown-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    // Add gradient stops
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#ff4444');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '25%');
    stop2.setAttribute('stop-color', '#ff8844');
    const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop3.setAttribute('offset', '50%');
    stop3.setAttribute('stop-color', '#ffaa44');
    const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop4.setAttribute('offset', '75%');
    stop4.setAttribute('stop-color', '#ffcc44');
    const stop5 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop5.setAttribute('offset', '100%');
    stop5.setAttribute('stop-color', '#ff4444');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    gradient.appendChild(stop4);
    gradient.appendChild(stop5);
    defs.appendChild(gradient);

    // Create background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '100');
    bgCircle.setAttribute('cy', '100');
    bgCircle.setAttribute('r', '90');
    bgCircle.className = 'countdown-bg-circle';

    // Create progress circle
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', '100');
    progressCircle.setAttribute('cy', '100');
    progressCircle.setAttribute('r', '90');
    progressCircle.className = 'countdown-progress-circle';

    svg.appendChild(defs);
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);

    // Create timer text container
    const textContainer = document.createElement('div');
    textContainer.className = 'countdown-text-container';

    const numberDisplay = document.createElement('div');
    numberDisplay.className = 'countdown-number';
    numberDisplay.textContent = '0';

    const labelDisplay = document.createElement('div');
    labelDisplay.className = 'countdown-label';
    labelDisplay.textContent = this.fieldJson?.timerLabel || 'SECONDS';

    textContainer.appendChild(numberDisplay);
    textContainer.appendChild(labelDisplay);

    progressContainer.appendChild(svg);
    progressContainer.appendChild(textContainer);

    timerContainer.innerHTML = '';
    timerContainer.appendChild(progressContainer);
  }

  /**
   * Updates the timer display with current values
   */
  updateTimerDisplay() {
    const numberDisplay = this.fieldDiv.querySelector('.countdown-number');
    const progressCircle = this.fieldDiv.querySelector('.countdown-progress-circle');

    if (numberDisplay) {
      numberDisplay.textContent = this.currentValue;
    }

    if (progressCircle && this.initialValue > 0) {
      const progress = (this.initialValue - this.currentValue) / this.initialValue;
      const circumference = 2 * Math.PI * 90;
      const strokeDasharray = circumference;
      const strokeDashoffset = circumference - (progress * circumference);

      progressCircle.style.strokeDasharray = strokeDasharray;
      progressCircle.style.strokeDashoffset = strokeDashoffset;
    }
  }

  /**
   * Starts the countdown timer
   */
  startTimer() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.initialValue = this.currentValue || this.initialValue;

    this.timerInterval = setInterval(() => {
      if (this.currentValue > 0) {
        this.currentValue -= 1;
        this.updateTimerDisplay();
        this.updateModel();
      } else {
        this.stopTimer();
      }
    }, 1000);
  }

  /**
   * Stops the countdown timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
    // Capture the current value when stopped
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

    // Listen for custom events
    this.customEvents.forEach((eventName) => {
      this.fieldModel.subscribe((event) => {
        if (eventName === 'startTimer') {
          this.startTimer();
        } else if (eventName === 'stopTimer') {
          this.stopTimer();
        }
      }, eventName);
    });
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
