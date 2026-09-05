import React from 'react';
import ReactDOM from 'react-dom/client';
import 'typeface-roboto'; // Local Roboto font instead of Google Fonts CDN
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './components/AuthContext';

// Apply the saved device palette before React mounts to avoid a flash of the
// opposite theme while the dashboard is loading.
const savedDarkMode = JSON.parse(localStorage.getItem('isDarkMode') || 'false');
document.documentElement.dataset.uiTheme = savedDarkMode ? 'night-ops' : 'ember-command';
document.documentElement.classList.toggle('dark', savedDarkMode);

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
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
