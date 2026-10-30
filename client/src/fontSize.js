// Text size is a per-device preference for users with weak eyesight. Everything is sized in rem,
// so scaling the root font size scales the whole page.
const KEY = 'matching.fontScale';
export const FONT_SCALES = [100, 115, 130, 150, 175];

export function getFontScale() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return FONT_SCALES.includes(v) ? v : 100;
  } catch {
    return 100;
  }
}

export function setFontScale(scale) {
  document.documentElement.style.fontSize = `${scale}%`;
  try {
    localStorage.setItem(KEY, String(scale));
  } catch {
    /* storage unavailable: applies until reload */
  }
}

export const applySavedFontScale = () => {
  document.documentElement.style.fontSize = `${getFontScale()}%`;
};
