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
// Skip when we're embedded in a third-party iframe (e.g. itch.io's
// html-classic.itch.zone wrapper) — SW registration there either fails or
// points at the wrong origin. Direct visits to our own domain still register.
if ('serviceWorker' in navigator && window.self === window.top) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
