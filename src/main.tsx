import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initTelegram } from './lib/telegram';
import { initSentry } from './lib/sentry';
import './index.css';

// Init error tracking before anything else
initSentry();

// Initialize Telegram WebApp
initTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
