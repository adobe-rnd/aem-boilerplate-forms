import { subscribe } from '../../rules/index.js';

export default function decorate(fieldDiv, fieldJson, container, formId) {
  // Access custom properties defined in the JSON
  const {
    buttonText = 'Draw Signature',
    canvasWidth = 400,
    canvasHeight = 200,
    penColor = '#000000',
    penWidth = 2,
  } = fieldJson?.properties || {};

  // Find the existing file input
  const fileInput = fieldDiv.querySelector('input[type="file"]');
  if (!fileInput) {
    console.error('File input not found in sign component');
    return;
  }

  // Create signature canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.classList.add('signature-canvas');
  // Ensure white background is applied
  canvas.style.backgroundColor = '#ffffff';

  // Create canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.classList.add('signature-canvas-container');
  canvasContainer.appendChild(canvas);

  // Create control buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('signature-controls');

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Reset';
  clearButton.classList.add('signature-clear-btn');

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = buttonText;
  saveButton.classList.add('signature-save-btn');

  buttonContainer.appendChild(clearButton);
  buttonContainer.appendChild(saveButton);

  // Insert canvas and controls after the label
  // First try to find the label in the fieldDiv
  let label = fieldDiv.querySelector('label');

  if (!label) {
    // If no label found in fieldDiv, try to find it in field-wrapper
    const fieldWrapper = fieldDiv.querySelector('.field-wrapper');
    if (fieldWrapper) {
      label = fieldWrapper.querySelector('label');
    }
  }

  if (label) {
    // Insert canvas container after the label
    label.parentNode.insertBefore(canvasContainer, label.nextSibling);
    // Insert button container after the canvas container
    canvasContainer.parentNode.insertBefore(buttonContainer, canvasContainer.nextSibling);
  } else {
    // Fallback: insert at beginning of fieldDiv if no label found
    fieldDiv.insertBefore(canvasContainer, fieldDiv.firstChild);
    fieldDiv.insertBefore(buttonContainer, canvasContainer.nextSibling);
  }

  // Canvas drawing functionality
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let points = [];

  // Set canvas styles
  ctx.strokeStyle = penColor;
  ctx.lineWidth = penWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Set canvas context background to white for drawing area
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get canvas coordinates from client coordinates
  function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Draw smooth line between points
  function drawSmoothLine() {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
  }

  // Mouse events for drawing
  function startDrawing(e) {
    isDrawing = true;
    points = [];
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    lastX = coords.x;
    lastY = coords.y;
    points.push({ x: lastX, y: lastY });
  }

  function draw(e) {
    if (!isDrawing) return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const currentX = coords.x;
    const currentY = coords.y;

    // Add point to array
    points.push({ x: currentX, y: currentY });

    // Draw line from last point to current point
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
  }

  function stopDrawing() {
    if (isDrawing) {
      isDrawing = false;
      // Draw final smooth line
      drawSmoothLine();
      points = [];
    }
  }

  // Touch events for mobile devices
  function startDrawingTouch(e) {
    e.preventDefault();
    isDrawing = true;
    points = [];
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    lastX = coords.x;
    lastY = coords.y;
    points.push({ x: lastX, y: lastY });
  }

  function drawTouch(e) {
    e.preventDefault();
    if (!isDrawing) return;

    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    const currentX = coords.x;
    const currentY = coords.y;

    // Add point to array
    points.push({ x: currentX, y: currentY });

    // Draw line from last point to current point
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
  }

  function stopDrawingTouch() {
    if (isDrawing) {
      isDrawing = false;
      // Draw final smooth line
      drawSmoothLine();
      points = [];
    }
  }

  // Add event listeners
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Touch events for mobile
  canvas.addEventListener('touchstart', startDrawingTouch);
  canvas.addEventListener('touchmove', drawTouch);
  canvas.addEventListener('touchend', stopDrawingTouch);

  // Clear button functionality
  clearButton.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Save button functionality
  saveButton.addEventListener('click', () => {
    // Check if canvas has content
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((channel) => channel !== 0);

    if (!hasContent) {
      alert('Please draw a signature before saving.');
      return;
    }

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        // Create a File object from the blob
        const signatureFile = new File([blob], 'signature.png', {
          type: 'image/png',
          lastModified: Date.now(),
        });

        // Create a DataTransfer object to set the file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(signatureFile);

        // Set the file input value
        fileInput.files = dataTransfer.files;

        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Signature saved successfully!';
        successMsg.classList.add('signature-success-msg');

        // Remove existing success message if any
        const existingMsg = buttonContainer.querySelector('.signature-success-msg');
        if (existingMsg) {
          existingMsg.remove();
        }

        buttonContainer.appendChild(successMsg);

        // Auto-remove success message after 3 seconds
        setTimeout(() => {
          if (successMsg.parentNode) {
            successMsg.remove();
          }
        }, 3000);
      }
    }, 'image/png');
  });

  // Subscribe to field changes if needed
  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel) => {
    fieldModel.subscribe((event) => {
      // React to field changes if needed
      console.log('Sign component field changed:', event);
    }, 'change');
  });

  // Hide the original file input since we're using the canvas
  fileInput.style.display = 'none';
  fileInput.style.pointerEvents = 'none'; // Ensure it's unclickable

  // Also hide the drag and drop area if it exists
  const dragArea = fieldDiv.querySelector('.file-drag-area');
  if (dragArea) {
    dragArea.style.display = 'none';
  }
}
