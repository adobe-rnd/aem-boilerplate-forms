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
    this.propertyChanges = ['value', 'visible', 'enabled'];
    this.customEvents = ['startTimer', 'stopTimer'];

    // Timer state
    this.timerInterval = null;
    this.initialValue = 0;
    this.currentValue = 0;
    this.isRunning = false;

    // DOM elements
    this.timerContainer = null;
    this.progressCircle = null;
    this.timerDisplay = null;
    this.timerLabel = null;
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Update the field model with the current timer value
    if (this.fieldModel && this.currentValue !== undefined) {
      this.fieldModel.value = this.currentValue;
    }
  }

  /**
   * Creates the circular progress bar HTML structure
   * @returns {string} HTML string for the timer
   */
  // eslint-disable-next-line class-methods-use-this
  createTimerHTML() {
    const timerHTML = `
      <div class="countdown-timer-container">
        <div class="countdown-timer-circle">
          <svg class="countdown-timer-svg" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ff0000;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ff6600;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffff00;stop-opacity:1" />
              </linearGradient>
            </defs>
            <circle class="countdown-timer-bg" cx="50" cy="50" r="45"></circle>
            <circle class="countdown-timer-progress" cx="50" cy="50" r="45"></circle>
          </svg>
          <div class="countdown-timer-content">
            <div class="countdown-timer-display">0</div>
            <div class="countdown-timer-label">SECONDS</div>
          </div>
        </div>
      </div>
    `;
    return timerHTML;
  }

  /**
   * Updates the circular progress bar
   */
  updateProgressBar() {
    if (!this.progressCircle || this.initialValue === 0) return;

    const progress = (this.initialValue - this.currentValue) / this.initialValue;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (progress * circumference);

    this.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    this.progressCircle.style.strokeDashoffset = offset;
  }

  /**
   * Updates the timer display
   */
  updateTimerDisplay() {
    if (this.timerDisplay) {
      this.timerDisplay.textContent = this.currentValue;
    }
  }

  /**
   * Starts the countdown timer
   */
  startTimer() {
    if (this.isRunning) return;

    // Get initial value from timerDuration property, field model, or default
    this.initialValue = this.fieldJson?.properties?.timerDuration
      || this.fieldModel?.value || this.fieldJson?.default || 60;
    this.currentValue = this.initialValue;

    this.isRunning = true;
    this.updateTimerDisplay();
    this.updateProgressBar();

    this.timerInterval = setInterval(() => {
      if (this.currentValue > 0) {
        this.currentValue -= 1;
        this.updateTimerDisplay();
        this.updateProgressBar();
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
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Capture the final value
    this.updateModel();
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      // Initialize timer display if not already created
      if (!this.timerContainer) {
        this.initializeTimerView();
      }

      // Update visibility
      if (this.timerContainer) {
        this.timerContainer.style.display = state.visible !== false ? 'block' : 'none';
      }

      // Update enabled state
      if (this.timerContainer) {
        this.timerContainer.classList.toggle('disabled', state.enabled === false);
      }
    }
  }

  /**
   * Initializes the timer view elements
   */
  initializeTimerView() {
    // Replace the default input with our custom timer
    const inputElement = this.fieldDiv.querySelector('input[type="number"]');
    if (inputElement) {
      inputElement.style.display = 'none';
    }

    // Create timer container
    this.timerContainer = document.createElement('div');
    this.timerContainer.innerHTML = this.createTimerHTML();
    this.fieldDiv.appendChild(this.timerContainer);

    // Get references to timer elements
    this.progressCircle = this.timerContainer.querySelector('.countdown-timer-progress');
    this.timerDisplay = this.timerContainer.querySelector('.countdown-timer-display');
    this.timerLabel = this.timerContainer.querySelector('.countdown-timer-label');

    // Set initial values
    this.initialValue = this.fieldJson?.properties?.timerDuration
      || this.fieldJson?.default || 60;
    this.currentValue = this.initialValue;
    this.updateTimerDisplay();
    this.updateProgressBar();
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
    if (this.customEvents && this.customEvents.length > 0) {
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
