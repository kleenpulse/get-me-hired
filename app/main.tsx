import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { App } from './App';
import { AppProvider } from './state';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element');

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
