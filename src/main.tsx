import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely handle and silence benign HMR and WebSocket errors in the developer environment
if (typeof window !== 'undefined') {
  // Double-protect with global event listeners to prevent any developer overlay errors
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonStr = reason ? (reason.message || String(reason)) : '';
    const reasonLower = reasonStr.toLowerCase();
    if (
      reasonLower.includes('websocket') || 
      reasonLower.includes('failed to connect') || 
      reasonLower.includes('closed without opened') ||
      reasonLower.includes('connection')
    ) {
      event.preventDefault();
      event.stopPropagation();
      console.log('[Dev System] Suppressed unhandled WebSocket rejection:', reasonStr);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = (event.message || '').toLowerCase();
    if (
      msg.includes('websocket') || 
      msg.includes('failed to connect') || 
      msg.includes('closed without opened') ||
      msg.includes('connection')
    ) {
      event.preventDefault();
      event.stopPropagation();
      console.log('[Dev System] Suppressed WebSocket connection error.');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

