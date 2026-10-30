import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { applySavedContrast } from './contrast.js';
import { applySavedFontScale } from './fontSize.js';

applySavedFontScale();
applySavedContrast();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
