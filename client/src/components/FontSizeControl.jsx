import { useState } from 'react';
import { getHighContrast, setHighContrast } from '../contrast.js';
import { FONT_SCALES, getFontScale, setFontScale } from '../fontSize.js';

export default function FontSizeControl({ className = '', buttonClass = 'hover:bg-slate-200' }) {
  const [scale, setScale] = useState(getFontScale);
  const [contrast, setContrast] = useState(getHighContrast);

  const step = (dir) => {
    const next = FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, FONT_SCALES.indexOf(scale) + dir))];
    setFontScale(next);
    setScale(next);
  };
  const btn = `grid size-8 place-items-center rounded-lg font-semibold disabled:opacity-30 ${buttonClass}`;

  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="ขนาดตัวอักษร">
      <button type="button" onClick={() => step(-1)} disabled={scale === FONT_SCALES[0]} className={`${btn} text-xs`} aria-label="ลดขนาดตัวอักษร">
        ก
      </button>
      <span className="hidden w-10 text-center text-xs sm:block tabular-nums opacity-80" aria-live="polite">
        {scale}%
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={scale === FONT_SCALES.at(-1)}
        className={`${btn} text-lg`}
        aria-label="เพิ่มขนาดตัวอักษร"
      >
        ก
      </button>
      <button
        type="button"
        onClick={() => {
          setHighContrast(!contrast);
          setContrast(!contrast);
        }}
        aria-pressed={contrast}
        aria-label="โหมดสีตัดกันสูง"
        title="โหมดสีตัดกันสูง"
        className={`${btn} ml-1 text-base ${contrast ? 'bg-current/20 ring-2 ring-current' : ''}`}
      >
        ◐
      </button>
    </div>
  );
}
