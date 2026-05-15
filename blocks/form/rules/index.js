// Re-export from form-bundle.min.js so all consumers (custom components, etc.) share
// the same module instance and formSubscriptions Map as loadRuleEngine in the bundle.
export { subscribe } from '../form-bundle.min.js';
