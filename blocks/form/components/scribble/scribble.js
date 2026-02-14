class ScribbleSignature {
  constructor(fieldDiv, fieldJson) {
    this.fieldDiv = fieldDiv;
    this.fieldJson = fieldJson;

    // Extract user properties
    this.buttonText = fieldJson?.properties?.buttonText || 'Save Signature';
    this.penWidth = fieldJson?.properties?.penWidth || 1;

    // Fixed values
    this.canvasHeight = 200;
    this.penColor = '#000000';

    // Component state
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.points = [];

    // DOM elements
    this.fileInput = null;
    this.canvas = null;
    this.ctx = null;
    this.canvasContainer = null;
    this.buttonContainer = null;
    this.clearButton = null;
    this.saveButton = null;

    this.init();
  }

  init() {
    this.findFileInput();
    this.createCanvas();
    this.createControls();
    this.appendElements();
    this.setupCanvas();
    this.bindEvents();
    this.hideOriginalElements();
  }

  findFileInput() {
    this.fileInput = this.fieldDiv.querySelector('input[type="file"]');
    if (!this.fileInput) {
      console.error('File input not found in sign component');
      throw new Error('File input not found');
    }
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('signature-canvas');

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.classList.add('signature-canvas-container');
    this.canvasContainer.appendChild(this.canvas);
  }

  createControls() {
    this.buttonContainer = document.createElement('div');
    this.buttonContainer.classList.add('signature-controls');

    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.textContent = 'Reset';
    this.clearButton.classList.add('signature-clear-btn');

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.textContent = this.buttonText;
    this.saveButton.classList.add('signature-save-btn');

    this.buttonContainer.appendChild(this.clearButton);
    this.buttonContainer.appendChild(this.saveButton);
  }

  appendElements() {
    this.fieldDiv.appendChild(this.canvasContainer);
    this.fieldDiv.appendChild(this.buttonContainer);
  }

  setupCanvas() {
    this.ctx = this.canvas.getContext('2d');

    requestAnimationFrame(() => {
      this.makeCanvasResponsive();
    });

    // Watch for container resize (mobile responsive fix)
    const resizeObserver = new ResizeObserver(() => {
      this.makeCanvasResponsive();
    });
    resizeObserver.observe(this.canvasContainer);

    // Set initial canvas styles
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.penWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  makeCanvasResponsive() {
    const rect = this.canvasContainer.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    // Match canvas resolution to its display size * devicePixelRatio
    this.canvas.width = rect.width * ratio;
    this.canvas.height = this.canvasHeight * ratio;

    // CSS size stays the same
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;

    // Scale context so 1 unit = 1 CSS pixel
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // Reset styles + background
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.penWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getCanvasCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  drawSmoothLine() {
    if (this.points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i += 1) {
      const point = this.points[i];
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.stroke();
  }

  // Mouse event handlers
  startDrawing = (e) => {
    this.isDrawing = true;
    this.points = [];
    const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.points.push({ x: this.lastX, y: this.lastY });
  };

  draw = (e) => {
    if (!this.isDrawing) return;

    const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
    const currentX = coords.x;
    const currentY = coords.y;

    this.points.push({ x: currentX, y: currentY });

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);
    this.ctx.stroke();

    this.lastX = currentX;
    this.lastY = currentY;
  };

  stopDrawing = () => {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.drawSmoothLine();
      this.points = [];
    }
  };

  // Touch event handlers
  startDrawingTouch = (e) => {
    e.preventDefault();
    this.isDrawing = true;
    this.points = [];
    const touch = e.touches[0];
    const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY);
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.points.push({ x: this.lastX, y: this.lastY });
  };

  drawTouch = (e) => {
    e.preventDefault();
    if (!this.isDrawing) return;

    const touch = e.touches[0];
    const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY);
    const currentX = coords.x;
    const currentY = coords.y;

    this.points.push({ x: currentX, y: currentY });

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);
    this.ctx.stroke();

    this.lastX = currentX;
    this.lastY = currentY;
  };

  stopDrawingTouch = () => {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.drawSmoothLine();
      this.points = [];
    }
  };

  // Button event handlers
  handleClear = () => {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Clear the file input value
    this.fileInput.value = '';

    // Clear the files property
    this.fileInput.files = new DataTransfer().files;

    // Trigger change event to notify the form
    const changeEvent = new Event('change', { bubbles: true });
    this.fileInput.dispatchEvent(changeEvent);
  };

  handleSave = () => {
    // Check if canvas has content
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const hasContent = imageData.data.some((channel) => channel !== 0);

    if (!hasContent) {
      alert('Please draw a signature before saving.');
      return;
    }

    // Convert canvas to blob
    this.canvas.toBlob((blob) => {
      if (blob) {
        this.saveSignatureAsFile(blob);
        this.showSuccessMessage();
      }
    }, 'image/png');
  };

  saveSignatureAsFile(blob) {
    // Create a File object from the blob
    const signatureFile = new File([blob], 'signature.png', {
      type: 'image/png',
      lastModified: Date.now(),
    });

    // Create a DataTransfer object to set the file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(signatureFile);

    // Set the file input value
    this.fileInput.files = dataTransfer.files;

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    this.fileInput.dispatchEvent(changeEvent);
  }

  showSuccessMessage() {
    const successMsg = document.createElement('div');
    successMsg.textContent = 'Signature saved successfully!';
    successMsg.classList.add('signature-success-msg');

    // Remove existing success message if any
    const existingMsg = this.buttonContainer.querySelector('.signature-success-msg');
    if (existingMsg) {
      existingMsg.remove();
    }

    this.buttonContainer.appendChild(successMsg);

    // Auto-remove success message after 3 seconds
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.remove();
      }
    }, 3000);
  }

  bindEvents() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.startDrawing);
    this.canvas.addEventListener('mousemove', this.draw);
    this.canvas.addEventListener('mouseup', this.stopDrawing);
    this.canvas.addEventListener('mouseout', this.stopDrawing);

    // Touch events
    this.canvas.addEventListener('touchstart', this.startDrawingTouch);
    this.canvas.addEventListener('touchmove', this.drawTouch);
    this.canvas.addEventListener('touchend', this.stopDrawingTouch);

    // Button events
    this.clearButton.addEventListener('click', this.handleClear);
    this.saveButton.addEventListener('click', this.handleSave);
  }

  hideOriginalElements() {
    // Hide the original file input
    this.fileInput.style.display = 'none';
    this.fileInput.style.pointerEvents = 'none';

    // Hide drag and drop area if it exists
    const dragArea = this.fieldDiv.querySelector('.file-drag-area');
    if (dragArea) {
      dragArea.style.display = 'none';
    }
  }
}

export default function decorate(fieldDiv, fieldJson) {
  try {
    /* eslint-disable no-new */
    new ScribbleSignature(fieldDiv, fieldJson);
  } catch (error) {
    console.error('Failed to initialize scribble signature component:', error);
  }
  return fieldDiv;
}
