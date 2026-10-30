// High-contrast mode: darker text and borders, set via a class on <html> (see index.css).
const KEY = 'matching.highContrast';

export const getHighContrast = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export function setHighContrast(on) {
  document.documentElement.classList.toggle('hc', on);
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable: applies until reload */
  }
}

export const applySavedContrast = () => document.documentElement.classList.toggle('hc', getHighContrast());
