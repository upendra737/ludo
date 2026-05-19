import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SocketProvider } from './context/SocketContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>,
);

// PWA: register the service worker (installable + instant repeat loads).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
