import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Vite development must never be controlled by an old production worker.
    if (import.meta.env.DEV) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.filter(key => key.startsWith('deepfake-defender')).map(key => caches.delete(key)));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { updateViaCache: 'none' });
      await registration.update();
    } catch (error) {
      console.warn('Service worker registration failed.', error);
    }
  });
}
