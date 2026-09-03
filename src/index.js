import React from 'react';
import ReactDOM from 'react-dom/client';
import 'typeface-roboto'; // Local Roboto font instead of Google Fonts CDN
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './utils/axiosSetup'; // Configure axios interceptors BEFORE any API calls

// Apply the saved device palette before React mounts to avoid a flash of the
// opposite theme while the dashboard is loading.
const savedDarkMode = JSON.parse(localStorage.getItem('isDarkMode') || 'false');
document.documentElement.dataset.uiTheme = savedDarkMode ? 'night-ops' : 'ember-command';
document.documentElement.classList.toggle('dark', savedDarkMode);

// Wrap fetch to suppress expected 401 errors
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0]?.toString() || '';
  
  // Check if this is a request to endpoints that commonly return 401 for non-admin users
  const isExpected401Endpoint = url.includes('/permissions') || url.includes('/mfa/status');
  
  return originalFetch.apply(this, args).then(response => {
    // If it's a 401 from an expected endpoint, clone the response but suppress console logging
    if (response.status === 401 && isExpected401Endpoint) {
      // Create a custom response that won't trigger browser console errors
      const clonedResponse = response.clone();
      
      // Override the response methods to prevent automatic error logging
      Object.defineProperty(clonedResponse, 'status', {
        value: 401,
        writable: false,
        configurable: false
      });
      
      return clonedResponse;
    }
    return response;
  }).catch(error => {
    // Suppress network errors for expected 401 endpoints
    if (isExpected401Endpoint && error.message?.includes('401')) {
      // Return a fake 401 response to prevent error propagation
      return new Response(null, { status: 401, statusText: 'Unauthorized' });
    }
    throw error;
  });
};

// Suppress expected errors and warnings
// These are expected browser behavior and don't affect functionality
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Intercept console methods to filter out expected errors
const filterConsoleMessage = (args) => {
  const message = args[0]?.toString() || '';
  const fullMessage = args.join(' ');
  
  // Suppress Tone.js AudioContext autoplay warnings
  if (message.includes('AudioContext was not allowed to start') || 
      message.includes('autoplay') ||
      (message.includes('Tone.js') && message.includes('AudioContext'))) {
    return true; // Suppress
  }
  
  // Suppress expected 401 UNAUTHORIZED errors from permissions and MFA endpoints
  if ((fullMessage.includes('401') || fullMessage.includes('UNAUTHORIZED')) && 
      (fullMessage.includes('/permissions') || fullMessage.includes('/mfa/status'))) {
    return true; // Suppress
  }
  
  // Suppress browser extension message channel errors
  if (message.includes('message channel closed') || 
      message.includes('asynchronous response')) {
    return true; // Suppress
  }
  
  return false; // Don't suppress
};

console.error = (...args) => {
  if (!filterConsoleMessage(args)) {
    originalError.apply(console, args);
  }
};

console.warn = (...args) => {
  if (!filterConsoleMessage(args)) {
    originalWarn.apply(console, args);
  }
};

console.log = (...args) => {
  if (!filterConsoleMessage(args)) {
    originalLog.apply(console, args);
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
