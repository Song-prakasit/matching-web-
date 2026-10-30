import { PillIcon } from './Icons.jsx';

// Hospital logo from the settings page; falls back to the pill icon until one is uploaded.
export default function Logo({ src, className = 'size-16', iconClass = 'size-8', alt = '' }) {
  return src ? (
    <img src={src} alt={alt} className={`${className} shrink-0 object-contain`} />
  ) : (
    <div className={`${className} grid shrink-0 place-items-center rounded-full bg-teal-800 text-white`}>
      <PillIcon className={iconClass} />
    </div>
  );
}
