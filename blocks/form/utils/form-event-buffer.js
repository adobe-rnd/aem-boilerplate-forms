/**
 * Form Event Buffer Plugin
 * 
 * This plugin buffers form-related events in localStorage when they're not sampled by RUM,
 * and flushes all buffered events when the form is submitted (if formsubmit is also not sampled).
 * This ensures we don't lose form interaction data due to RUM sampling.
 * 
 * Form-specific checkpoints tracked:
 * - fill: Form field changes
 * - click: Form field focus events
 * - viewblock: Form visibility events
 * - formsubmit: Generic form submissions
 * - search: Search form submissions
 * - login: Login form submissions
 * - signup: Signup form submissions
 */

console.log('📦 Form Event Buffer Plugin: File loaded');
console.log('🔍 Debug: Current URL:', window.location.href);
console.log('🔍 Debug: Forms on page:', document.querySelectorAll('form').length);
console.log('🔍 Debug: RUM system available:', !!(window.hlx && window.hlx.rum));

const BUFFER_KEY = 'helix-rum-form-buffer';
const MAX_BUFFER_SIZE = 50; // Maximum number of events to buffer per session
const BUFFER_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Form-specific checkpoints to track
const FORM_CHECKPOINTS = [
  'fill',        // Form field changes
  'click',       // Form field focus events
  'viewblock',   // Form visibility events
  'formsubmit',  // Generic form submissions
  'search',      // Search form submissions
  'login',       // Login form submissions
  'signup'       // Signup form submissions
];

// Only formsubmit checkpoint triggers buffer flush
const FORM_SUBMIT_FLUSH_CHECKPOINT = 'formsubmit';

/**
 * Check if localStorage is available and supported
 * @returns {boolean} True if localStorage is available
 */
function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    console.log('🔍 isLocalStorageAvailable:', test);
    return true;
  } catch (e) {
    console.log('🔍 isLocalStorageAvailable:', e);
    return false;
  }
}

/**
 * Get RUM session ID with proper null checks and browser compatibility
 * @returns {string} RUM session ID
 */
function getRumSessionId() {
  try {
    // Check if window.hlx exists and has rum property
    if (window.hlx && window.hlx.rum && window.hlx.rum.id) {
      return window.hlx.rum.id;
    }
  } catch (e) {
    // Handle cases where window.hlx might not be fully initialized
    console.warn('RUM session ID not available:', e);
  }
  
  // Fallback to a default session ID
  return 'default-session';
}

/**
 * Get buffer key based on RUM session ID
 * @returns {string} Buffer key
 */
function getBufferKey() {
  const rumSessionId = getRumSessionId();
  return `${BUFFER_KEY}-${rumSessionId}`;
}

/**
 * Get buffered events from localStorage for the current session
 * @returns {Array} Array of buffered events
 */
function getBufferedEvents() {
  if (!isLocalStorageAvailable()) {
    return [];
  }
  
  try {
    const bufferKey = getBufferKey();
    const stored = localStorage.getItem(bufferKey);
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Check if buffer itself has expired
    if (data._expiry && now > data._expiry) {
      localStorage.removeItem(bufferKey);
      return [];
    }
    
    // Return all events for the session
    return data.events || [];
  } catch (e) {
    console.warn('Failed to get buffered form events:', e);
    return [];
  }
}

/**
 * Buffer an event in localStorage for the current session
 * @param {Object} eventData - The event data to buffer
 */
function bufferEvent(eventData) {
  if (!isLocalStorageAvailable()) {
    return;
  }
  
  try {
    const bufferKey = getBufferKey();
    const stored = localStorage.getItem(bufferKey);
    const data = stored ? JSON.parse(stored) : {};
    
    // Set buffer expiry if not set
    if (!data._expiry) {
      data._expiry = Date.now() + BUFFER_EXPIRY;
    }
    
    // Initialize events array if not exists
    if (!data.events) {
      data.events = [];
    }
    
    // Add the event
    data.events.push({
      ...eventData,
      bufferedAt: Date.now()
    });
    
    // Limit the number of buffered events for the session
    if (data.events.length > MAX_BUFFER_SIZE) {
      data.events = data.events.slice(-MAX_BUFFER_SIZE);
    }
    
    localStorage.setItem(bufferKey, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to buffer form event:', e);
  }
}

/**
 * Clear buffered events for the current session
 */
function clearBufferedEvents() {
  if (!isLocalStorageAvailable()) {
    return;
  }
  
  try {
    const bufferKey = getBufferKey();
    localStorage.removeItem(bufferKey);
  } catch (e) {
    console.warn('Failed to clear buffered form events:', e);
  }
}

/**
 * Single cleanup function - removes expired buffer entries
 */
function cleanupExpiredBuffer() {
  if (!isLocalStorageAvailable()) {
    return;
  }
  
  try {
    const bufferKey = getBufferKey();
    const stored = localStorage.getItem(bufferKey);
    
    if (!stored) return;
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Check if buffer itself has expired
    if (data._expiry && now > data._expiry) {
      localStorage.removeItem(bufferKey);
      return;
    }
    
    // Clean up expired events
    if (data.events && Array.isArray(data.events)) {
      const originalLength = data.events.length;
      data.events = data.events.filter(event => {
        return event.bufferedAt && (now - event.bufferedAt) <= BUFFER_EXPIRY;
      });
      
      // If events were removed, update buffer
      if (data.events.length !== originalLength) {
        localStorage.setItem(bufferKey, JSON.stringify(data));
      }
    }
  } catch (e) {
    console.warn('Failed to cleanup expired buffer:', e);
  }
}


/**
 * Check if an element is inside a form
 * @param {Element} element - The element to check
 * @returns {boolean} True if element is inside a form
 */
function isInsideForm(element) {
  return element.closest('form') !== null;
}

/**
 * Enhanced sampleRUM function that buffers form events when not sampled
 * @param {Function} originalSampleRUM - The original sampleRUM function
 * @param {string} checkpoint - The checkpoint name
 * @param {Object} data - The event data
 */
function enhancedSampleRUM(originalSampleRUM, checkpoint, data) {
  console.log('🔍 Enhanced sampleRUM called:', { checkpoint, data });
  
  // Check if this is a form-related checkpoint
  const isFormCheckpoint = FORM_CHECKPOINTS.includes(checkpoint);
  const element = findElementFromData(data);
  const isFormRelated = element && isInsideForm(element);
  
  // Buffer form-related events
  if (isFormCheckpoint || isFormRelated) {
    console.log('📝 Buffering form event:', { checkpoint, isFormCheckpoint, isFormRelated });
    bufferEvent({
      checkpoint,
      data,
      timestamp: Date.now()
    });
    
    // Check if this is the specific formsubmit checkpoint that should trigger buffer flush
    if (checkpoint === FORM_SUBMIT_FLUSH_CHECKPOINT) {
      console.log('🚀 Formsubmit detected, flushing buffer:', checkpoint);
      const allBufferedEvents = getBufferedEvents();
      
      if (allBufferedEvents.length > 0) {
        console.log('📤 Flushing', allBufferedEvents.length, 'buffered events');
        // Flush buffered events directly to RUM collector, bypassing sampling
        allBufferedEvents.forEach(bufferedEvent => {
          if (window.hlx && window.hlx.rum && window.hlx.rum.collector) {
            window.hlx.rum.collector(bufferedEvent.checkpoint, bufferedEvent.data, bufferedEvent.timestamp);
          }
        });
        clearBufferedEvents();
      }
    }
  }
  
  return originalSampleRUM(checkpoint, data);
}

/**
 * Find element from RUM data (source/target selectors)
 * @param {Object} data - RUM event data
 * @returns {Element|null} The element if found
 */
function findElementFromData(data) {
  if (!data || !data.source) return null;
  
  try {
    const element = document.querySelector(data.source);
    if (element) return element;
    
    if (data.target) {
      return document.querySelector(data.target);
    }
  } catch (e) {
    // Invalid selector, ignore
  }
  
  return null;
}

/**
 * Get form submit type (copied from form.js)
 * @param {Element} el - The form element
 * @returns {string} The submit type
 */
function getSubmitType(el) {
  if (!el || el.tagName !== 'FORM') return 'formsubmit';
  // if the form has a search role or a search field, it's a search form
  if (el.getAttribute('role') === 'search'
    || el.querySelector('input[type="search"], input[role="searchbox"]')) return 'search';
  // if the form has one password input, it's a login form
  // if the form has more than one password input, it's a signup form
  const pwCount = el.querySelectorAll('input[type="password"]').length;
  if (pwCount === 1) return 'login';
  if (pwCount > 1) return 'signup';
  return 'formsubmit';
}

/**
 * Create source selector for form elements
 * @param {Element} element - The form element
 * @returns {string} The source selector
 */
function createSourceSelector(element) {
  if (!element) return '';
  
  const tagName = element.tagName.toLowerCase();
  const type = element.type ? `[type='${element.type}']` : '';
  const name = element.name ? `[name='${element.name}']` : '';
  const id = element.id ? `#${element.id}` : '';
  const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
  
  return `${tagName}${type}${name}${id}${className}`;
}

/**
 * Create target selector for form elements
 * @param {Element} element - The form element
 * @returns {string} The target selector
 */
function createTargetSelector(element) {
  if (!element) return '';
  
  const form = element.closest('form');
  if (!form) return createSourceSelector(element);
  
  const formSelector = createSourceSelector(form);
  const elementSelector = createSourceSelector(element);
  
  return `${formSelector} ${elementSelector}`;
}

/**
 * Add direct form event listeners to capture form interactions
 * @param {Element} context - The context element to search for forms
 */
function addDirectFormListeners(context) {
  console.log('🔍 Adding direct form listeners to context:', context);
  
  const forms = context.querySelectorAll('form');
  console.log('🔍 Found', forms.length, 'forms to add listeners to');
  
  forms.forEach((form, index) => {
    console.log(`🔍 Adding listeners to form ${index + 1}:`, form);
    
    // Form submit listener
    form.addEventListener('submit', (submitEvent) => {
      console.log('📝 Direct form submit event:', submitEvent.target);
      const submitType = getSubmitType(submitEvent.target);
      const source = createSourceSelector(submitEvent.target);
      const target = createTargetSelector(submitEvent.target);
      
      // Buffer the submit event
      bufferEvent({
        checkpoint: submitType,
        data: { source, target },
        timestamp: Date.now()
      });
      
      // Only flush buffered events if this is a formsubmit checkpoint
      if (submitType === FORM_SUBMIT_FLUSH_CHECKPOINT) {
        console.log('🚀 Direct formsubmit detected, flushing buffer');
        const allBufferedEvents = getBufferedEvents();
        if (allBufferedEvents.length > 0) {
          console.log('📤 Flushing', allBufferedEvents.length, 'buffered events on direct formsubmit');
          allBufferedEvents.forEach(bufferedEvent => {
            if (window.hlx && window.hlx.rum && window.hlx.rum.collector) {
              window.hlx.rum.collector(bufferedEvent.checkpoint, bufferedEvent.data, bufferedEvent.timestamp);
            }
          });
          clearBufferedEvents();
        }
      } else {
        console.log('📝 Form submit detected but not formsubmit, not flushing buffer:', submitType);
      }
    }, { once: true });
    
    // Form field change listener (fill events)
    let lastSource;
    form.addEventListener('change', (changeEvent) => {
      console.log('📝 Direct form change event:', changeEvent.target);
      if (changeEvent.target.checkVisibility && changeEvent.target.checkVisibility()) {
        const source = createSourceSelector(changeEvent.target);
        if (source !== lastSource) {
          bufferEvent({
            checkpoint: 'fill',
            data: { source },
            timestamp: Date.now()
          });
          lastSource = source;
        }
      }
    });
    
    // Form field focus listener (click events)
    form.addEventListener('focusin', (focusEvent) => {
      console.log('📝 Direct form focus event:', focusEvent.target);
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(focusEvent.target.tagName)
        || focusEvent.target.getAttribute('contenteditable') === 'true') {
        const source = createSourceSelector(focusEvent.target);
        bufferEvent({
          checkpoint: 'click',
          data: { source },
          timestamp: Date.now()
        });
      }
    });
    
    // Form visibility listener (viewblock events)
    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver((entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e) => {
            observer.unobserve(e.target);
            const source = createSourceSelector(e.target);
            const target = createTargetSelector(e.target);
            console.log('📝 Direct form viewblock event:', e.target);
            bufferEvent({
              checkpoint: 'viewblock',
              data: { source, target },
              timestamp: Date.now()
            });
          });
      });
      observer.observe(form);
    }
  });
}

/**
 * Initialize form event buffer plugin
 * @param {Object} config - Plugin configuration
 * @param {Function} config.sampleRUM - The sampleRUM function
 * @param {Element} config.context - The context element to search for forms
 */
export default function addFormEventBuffer({ sampleRUM, context = document.body }) {
  console.log('🔍 Form Event Buffer Plugin: Initializing for non-sampled user', {
    hasRUM: !!(window.hlx && window.hlx.rum),
    hasCollector: !!(window.hlx && window.hlx.rum && window.hlx.rum.collector),
    isSelected: window.hlx?.rum?.isSelected,
    context: context
  });
  
  // Store the original sampleRUM function
  const originalSampleRUM = window.sampleRUM || sampleRUM;
  
  // Override the sampleRUM function
  window.sampleRUM = (checkpoint, data) => {
    return enhancedSampleRUM(originalSampleRUM, checkpoint, data);
  };

  // Add direct form event listeners to capture events even if RUM doesn't sample them
  addDirectFormListeners(context);
  
  // Clean up expired events periodically
  setInterval(cleanupExpiredBuffer, 30 * 60 * 1000);
  
  console.log('✅ Form Event Buffer Plugin: Initialized successfully');
}
