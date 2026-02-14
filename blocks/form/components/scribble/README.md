# Signature Component

The Signature Component extends the OOTB (Out-of-the-Box) file input component to provide signature drawing functionality with **Bezier curve interpolation** for smooth, natural signature rendering. Users can draw signatures directly on a canvas, and the signature is automatically converted to an image file and uploaded to the file input component.

## Features

- **Bezier curve signature rendering**: Uses quadratic Bezier curves for smooth, natural signature lines
- **Pressure simulation**: Dynamic line width variation based on drawing speed
- **Canvas-based signature drawing**: Interactive canvas for drawing signatures with mouse or touch
- **Touch support**: Optimized for mobile devices and touch screens
- **File integration**: Automatically converts signatures to PNG images and attaches them to the file input
- **Responsive design**: Adapts to different screen sizes
- **Clear functionality**: Easy-to-use clear button to reset the signature
- **Success feedback**: Visual confirmation when signature is saved
- **High-quality output**: Optimized for high DPI displays and dark mode

## How It Works

### Bezier Curve Implementation

1. **Point Collection**: Captures drawing points with distance-based filtering for smooth curves
2. **Control Point Calculation**: Automatically calculates optimal control points for each curve segment
3. **Quadratic Bezier Rendering**: Uses `quadraticCurveTo()` for smooth curve interpolation
4. **Pressure Simulation**: Varies line width based on drawing speed for realistic pen-like effects

### Signature Capture Process

1. **Drawing Interface**: The component provides a canvas where users can draw their signature using mouse or touch
2. **Real-time Smoothing**: Bezier curves are calculated and rendered in real-time as the user draws
3. **Signature Capture**: When the user clicks "Save Signature", the canvas content is converted to a PNG image
4. **File Integration**: The generated image is automatically attached to the underlying file input component
5. **Validation**: The signature file goes through the same validation as any other file upload (size limits, file types, etc.)

## Technical Details

### Bezier Curve Algorithm

```javascript
// Control point calculation for smooth curves
function calculateControlPoints(points) {
  // First segment: control point between current and next
  // Middle segments: weighted average for smooth transitions
  // Last segment: control point between current and next
}
```

### Pressure Simulation

- **Speed-based calculation**: Line width varies from 0.5px to 2.0px based on drawing speed
- **Smooth interpolation**: Line width changes smoothly between points
- **Realistic feel**: Simulates natural pen pressure variations

### Performance Optimizations

- **Distance filtering**: Only adds points when distance > 2px (reduces noise)
- **Efficient redrawing**: Optimized canvas clearing and redrawing
- **Touch optimization**: Specialized handling for mobile devices

## Usage

### Basic Implementation

```javascript
import { default as decorateSignature } from './blocks/form/components/sign/sign.js';

// Initialize the signature component
const fieldDiv = document.querySelector('.field-wrapper');
await decorateSignature(fieldDiv, field, htmlForm);
```

### HTML Structure

The component expects a field wrapper with a file input:

```html
<div class="field-wrapper">
    <input type="file" accept="image/*" multiple>
    <!-- Signature area and file list will be automatically inserted -->
</div>
```

## Configuration

The component supports the following configuration options through the field properties:

- `fd:buttonText`: Custom text for the file attachment button
- `dragDropText`: Custom text for the drag and drop area

## File Output

- **Format**: PNG image with Bezier curve rendering
- **Filename**: `signature.png`
- **MIME Type**: `image/png`
- **Quality**: High-quality canvas rendering with smooth curves
- **Resolution**: Optimized for high DPI displays

## Browser Support

- **Desktop**: Chrome, Firefox, Safari, Edge (modern versions)
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Touch Support**: Full touch event handling for mobile devices
- **Canvas Support**: Full HTML5 Canvas API support required

## Dependencies

The component extends the existing file input functionality and requires:
- File input component utilities
- Form validation functions
- Constants and error messages
- HTML5 Canvas API support

## Styling

The component includes comprehensive CSS styling with:
- **Responsive design** for mobile and desktop
- **Hover effects and transitions** for interactive feedback
- **Touch-optimized interactions** for mobile devices
- **Dark mode support** with automatic theme detection
- **High DPI display optimization** for crisp rendering
- **Consistent with AEM Forms design patterns**

## Accessibility

- **Keyboard navigation support** for all controls
- **Screen reader friendly** with proper ARIA labels
- **High contrast mode support** for visibility
- **Touch target sizing** for mobile accessibility
- **Focus indicators** for keyboard users

## Testing

Use the provided `test-signature.html` file to test the component functionality:

1. Open the test file in a modern browser
2. Draw a signature on the canvas (observe smooth Bezier curves)
3. Test different drawing speeds to see pressure variation
4. Click "Save Signature" to see the file attachment
5. Test touch functionality on mobile devices

## Performance Considerations

### Canvas Optimization

- **Efficient redrawing**: Only redraws when necessary
- **Point filtering**: Reduces unnecessary calculations
- **Memory management**: Proper cleanup of drawing state

### Mobile Performance

- **Touch event optimization**: Efficient touch handling
- **Responsive rendering**: Adapts to device capabilities
- **Battery optimization**: Minimal CPU usage during drawing

## Troubleshooting

### Common Issues

1. **Canvas not drawing**: Ensure the canvas element is properly initialized
2. **Touch not working**: Check if touch events are being captured
3. **File not attaching**: Verify the file input element exists and is accessible
4. **Poor curve quality**: Check browser Canvas API support

### Debug Mode

Enable console logging by setting `window.debugSignature = true` before initializing the component.

### Performance Issues

- **Slow rendering**: Reduce canvas size or point filtering distance
- **High memory usage**: Check for memory leaks in point storage
- **Touch lag**: Optimize touch event handling for mobile devices

## Future Enhancements

- **Multiple signature styles** and colors
- **Signature templates** and presets
- **Digital signature verification** with certificates
- **Integration with digital certificate systems**
- **Batch signature processing**
- **Advanced pressure sensitivity** for stylus devices
- **Signature analytics** and quality metrics
- **Cloud signature storage** and retrieval
