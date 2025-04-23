import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './splitPane.css';

// Add a global error handler to catch and log errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });
}

// Mount the app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 