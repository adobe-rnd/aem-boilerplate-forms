# Countdown Timer Component

A custom AEM Forms component that displays a countdown timer with a circular progress bar.

## Features

- **Circular Progress Bar**: Visual representation of remaining time with gradient colors (red to orange to yellow)
- **Event-Driven Control**: Start and stop the timer using `startTimer` and `stopTimer` events
- **Value Capture**: Automatically captures the remaining time when the timer is stopped
- **Configurable Duration**: Set custom timer duration through authoring properties
- **Responsive Design**: Adapts to different screen sizes

## Usage

### Authoring Properties

- **Timer Duration (seconds)**: Set the initial countdown duration (default: 35 seconds)
- **Default Value**: The field's default value
- **Label**: Display label for the component

### Events

- **startTimer**: Triggers the countdown timer to start
- **stopTimer**: Stops the timer and captures the remaining time as the field value

### Example Usage

```javascript
// Start the timer
fieldModel.dispatch('startTimer');

// Stop the timer (captures remaining time)
fieldModel.dispatch('stopTimer');
```

## Styling

The component uses CSS classes for styling:
- `.countdown-timer-container`: Main container
- `.countdown-progress-container`: Progress bar container
- `.countdown-timer-display`: Time display overlay
- `.countdown-time-number`: Large number display
- `.countdown-time-label`: "SECONDS" label

## Technical Details

- **Base Type**: Number Input
- **Field Type**: countdowntimer
- **Architecture**: MVC pattern with Model-View-Controller separation
- **SVG Progress**: Uses SVG with gradient for smooth circular progress animation
