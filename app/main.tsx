import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { App } from './App';
import { applyDisplay, readDisplayCopy } from './display';
import { AppProvider } from './state';

// The theme and text size, before the first paint, so the page doesn't flash (see display.ts).
applyDisplay(readDisplayCopy());

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element');

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
