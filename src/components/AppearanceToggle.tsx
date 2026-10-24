import { Moon, Sun } from 'lucide-react';
import { useApp } from '../AppContext';

export function AppearanceToggle() {
  const { accountAppearance, setAccountAppearance } = useApp();
  const dark = accountAppearance === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={dark}
      onClick={() => setAccountAppearance(dark ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-bakery-brown/15 text-bakery-brown hover:bg-bakery-beige/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bakery-caramel transition-colors">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
