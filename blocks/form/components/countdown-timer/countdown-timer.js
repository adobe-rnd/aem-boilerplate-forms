/* eslint-disable no-unused-vars */
import { subscribe } from '../../rules/index.js';

/**
 * CountdownTimerComponent - A class-based implementation of a countdown-timer component
 * extending Number Input. This class encapsulates all the functionality for managing a
 * form field's state, view updates, and event handling.
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
    this.customEvents = ['startTimer', 'stopTimer'];

    // Timer state
    this.timerInterval = null;
    this.currentTime = 0;
    this.initialTime = 0;
    this.isRunning = false;

    // Timer configuration from authoring properties
    this.duration = fieldJson?.properties?.duration || 60; // Default 60 seconds
    this.timerSize = fieldJson?.properties?.timerSize || 'medium';
    this.timerStyle = fieldJson?.properties?.timerStyle || 'gradient';
  }

  /**
   * This method is where you can update the fieldModel based on view changes.
   */
  updateModel() {
    // Update the field model with the current timer value when stopped
    if (this.fieldModel && !this.isRunning) {
      this.fieldModel.value = this.currentTime;
    }
  }

  /**
   * Gets the gradient colors based on timer style
   */
  getGradientColors() {
    switch (this.timerStyle) {
      case 'solid-red':
        return [
          { offset: '0%', color: '#ff0000' },
          { offset: '100%', color: '#ff0000' },
        ];
      case 'solid-blue':
        return [
          { offset: '0%', color: '#0066ff' },
          { offset: '100%', color: '#0066ff' },
        ];
      case 'gradient':
      default:
        return [
          { offset: '0%', color: '#ff0000' },
          { offset: '25%', color: '#ff6600' },
          { offset: '50%', color: '#ffaa00' },
          { offset: '75%', color: '#ffcc00' },
          { offset: '100%', color: '#ffdd00' },
        ];
    }
  }

  /**
   * Gets the timer size configuration
   */
  getTimerSizeConfig() {
    switch (this.timerSize) {
      case 'small':
        return { size: 80, fontSize: '1.5rem', labelSize: '0.6rem' };
      case 'large':
        return { size: 160, fontSize: '3.5rem', labelSize: '1rem' };
      case 'medium':
      default:
        return { size: 120, fontSize: '2.5rem', labelSize: '0.8rem' };
    }
  }

  /**
   * Creates the countdown timer HTML structure
   */
  createTimerHTML() {
    const timerContainer = document.createElement('div');
    timerContainer.className = 'countdown-timer-container';

    const progressCircle = document.createElement('div');
    progressCircle.className = 'countdown-progress-circle';

    const sizeConfig = this.getTimerSizeConfig();

    // Create SVG for the progress bar
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', sizeConfig.size.toString());
    svg.setAttribute('height', sizeConfig.size.toString());
    svg.className = 'countdown-svg';

    const center = sizeConfig.size / 2;
    const radius = (sizeConfig.size * 0.375); // 45px for 120px size, scaled proportionally

    // Background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', center.toString());
    bgCircle.setAttribute('cy', center.toString());
    bgCircle.setAttribute('r', radius.toString());
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#333');
    bgCircle.setAttribute('stroke-width', '8');

    // Progress circle
    const progressCircleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircleSvg.setAttribute('cx', center.toString());
    progressCircleSvg.setAttribute('cy', center.toString());
    progressCircleSvg.setAttribute('r', radius.toString());
    progressCircleSvg.setAttribute('fill', 'none');
    progressCircleSvg.setAttribute('stroke', 'url(#gradient)');
    progressCircleSvg.setAttribute('stroke-width', '8');
    progressCircleSvg.setAttribute('stroke-linecap', 'round');
    progressCircleSvg.setAttribute('transform', `rotate(-90 ${center} ${center})`);
    progressCircleSvg.className = 'countdown-progress-bar';

    // Gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    const gradientColors = this.getGradientColors();
    gradientColors.forEach((colorStop) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', colorStop.offset);
      stop.setAttribute('stop-color', colorStop.color);
      gradient.appendChild(stop);
    });

    defs.appendChild(gradient);

    svg.appendChild(defs);
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircleSvg);

    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'countdown-timer-display';
    timerDisplay.style.fontSize = sizeConfig.fontSize;

    const timeNumber = document.createElement('div');
    timeNumber.className = 'countdown-time-number';
    timeNumber.textContent = '00';

    const timeLabel = document.createElement('div');
    timeLabel.className = 'countdown-time-label';
    timeLabel.textContent = 'SECONDS';
    timeLabel.style.fontSize = sizeConfig.labelSize;

    timerDisplay.appendChild(timeNumber);
    timerDisplay.appendChild(timeLabel);
    progressCircle.appendChild(svg);
    progressCircle.appendChild(timerDisplay);
    timerContainer.appendChild(progressCircle);

    return timerContainer;
  }

  /**
   * Updates the timer display and progress bar
   */
  updateTimerDisplay() {
    const timeNumber = this.fieldDiv.querySelector('.countdown-time-number');
    const progressBar = this.fieldDiv.querySelector('.countdown-progress-bar');

    if (timeNumber) {
      timeNumber.textContent = this.currentTime.toString().padStart(2, '0');
    }

    if (progressBar && this.initialTime > 0) {
      const sizeConfig = this.getTimerSizeConfig();
      const radius = (sizeConfig.size * 0.375);
      const circumference = 2 * Math.PI * radius;
      const progress = (this.initialTime - this.currentTime) / this.initialTime;
      const strokeDasharray = circumference;
      const strokeDashoffset = circumference - (progress * circumference);

      progressBar.style.strokeDasharray = strokeDasharray;
      progressBar.style.strokeDashoffset = strokeDashoffset;
    }
  }

  /**
   * Starts the countdown timer
   */
  startTimer() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.initialTime = this.duration;
    this.currentTime = this.duration;

    this.updateTimerDisplay();

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
   * Stops the countdown timer
   */
  stopTimer() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Update the field model with the current value
    this.updateModel();
  }

  /**
   * Updates the form field HTML based on current state
   */
  updateView(state) {
    if (state) {
      // Initialize timer display if not already created
      if (!this.fieldDiv.querySelector('.countdown-timer-container')) {
        const timerHTML = this.createTimerHTML();
        this.fieldDiv.appendChild(timerHTML);
      }

      // Update timer display
      this.updateTimerDisplay();
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
    this.customEvents.forEach((eventName) => {
      this.fieldModel.subscribe((event) => {
        if (eventName === 'startTimer') {
          this.startTimer();
        } else if (eventName === 'stopTimer') {
          this.stopTimer();
        }
        this.updateView(this.fieldModel.getState());
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
