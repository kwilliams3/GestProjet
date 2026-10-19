import { useTheme } from '../theme.js';
import { MoonIcon, SunIcon } from './icons.jsx';

const OPTIONS = [
  { value: 'light', label: 'Clair', icon: SunIcon },
  { value: 'dark', label: 'Sombre', icon: MoonIcon },
];

/** Sélecteur du thème dans l'en-tête : « Clair » / « Sombre » (icônes seules sur mobile). */
export default function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Thème de l'interface">
      {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          title={`Mode ${label.toLowerCase()}`}
        >
          <OptionIcon className="btn-icon-svg" />
          <span className="theme-switch-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
