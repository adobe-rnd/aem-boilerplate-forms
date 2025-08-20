import { subscribe } from '../../rules/index.js';

export default function decorate(fieldDiv, fieldJson, container, formId) {
  // Access custom properties defined in the JSON
  const {
    buttonText = 'Draw Signature',
    dragDropText = 'Draw your signature below',
    canvasWidth = 400,
    canvasHeight = 200,
    penColor = '#000000',
    penWidth = 2
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
  canvas.style.border = '1px solid #ccc';
  canvas.style.borderRadius = '4px';
  canvas.style.cursor = 'crosshair';
  canvas.style.backgroundColor = '#ffffff';
  canvas.classList.add('signature-canvas');

  // Create canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.classList.add('signature-canvas-container');
  canvasContainer.style.marginBottom = '16px';
  canvasContainer.appendChild(canvas);

  // Create control buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('signature-controls');
  buttonContainer.style.marginBottom = '16px';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '8px';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Clear';
  clearButton.classList.add('signature-clear-btn');
  clearButton.style.padding = '8px 16px';
  clearButton.style.border = '1px solid #ccc';
  clearButton.style.borderRadius = '4px';
  clearButton.style.backgroundColor = '#f8f9fa';
  clearButton.style.cursor = 'pointer';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = buttonText;
  saveButton.classList.add('signature-save-btn');
  saveButton.style.padding = '8px 16px';
  saveButton.style.border = '1px solid #007cba';
  saveButton.style.borderRadius = '4px';
  saveButton.style.backgroundColor = '#007cba';
  saveButton.style.color = '#ffffff';
  saveButton.style.cursor = 'pointer';

  buttonContainer.appendChild(clearButton);
  buttonContainer.appendChild(saveButton);

  // Insert canvas and controls before the file input
  const fieldWrapper = fieldDiv.querySelector('.field-wrapper');
  if (fieldWrapper) {
    fieldWrapper.insertBefore(canvasContainer, fieldWrapper.firstChild);
    fieldWrapper.insertBefore(buttonContainer, canvasContainer.nextSibling);
  } else {
    fieldDiv.insertBefore(canvasContainer, fieldDiv.firstChild);
    fieldDiv.insertBefore(buttonContainer, canvasContainer.nextSibling);
  }

  // Canvas drawing functionality
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Set canvas styles
  ctx.strokeStyle = penColor;
  ctx.lineWidth = penWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Mouse events for drawing
  function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  }

  function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  // Touch events for mobile devices
  function startDrawingTouch(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    isDrawing = true;
  }

  function drawTouch(e) {
    e.preventDefault();
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
  }

  function stopDrawingTouch() {
    isDrawing = false;
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
    const hasContent = imageData.data.some(channel => channel !== 0);
    
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
          lastModified: Date.now()
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
        successMsg.style.color = '#28a745';
        successMsg.style.fontSize = '14px';
        successMsg.style.marginTop = '8px';
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
  
  // Also hide the drag and drop area if it exists
  const dragArea = fieldDiv.querySelector('.file-drag-area');
  if (dragArea) {
    dragArea.style.display = 'none';
  }
}
