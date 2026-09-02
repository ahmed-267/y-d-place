import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../AppContext';
import { APP_LANGUAGE_OPTIONS, getLanguageOption } from '../utils/languages';

type LanguageSwitcherProps = {
  align?: 'left' | 'right';
  compact?: boolean;
  className?: string;
};

export const LanguageSwitcher = ({
  align = 'right',
  compact = false,
  className = '',
}: LanguageSwitcherProps) => {
  const { lang, setLang, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = getLanguageOption(lang);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 border border-bakery-beige bg-white text-bakery-brown shadow-sm hover:border-bakery-caramel/50 transition-colors ${
          compact
            ? 'rounded-full px-2.5 sm:px-3 py-1 text-[10px] font-bold uppercase'
            : 'rounded-xl px-3 py-2 text-sm font-bold'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('localeLanguage')}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {active.flag}
        </span>
        <span className={compact ? 'hidden sm:inline' : ''}>
          {compact ? active.code.toUpperCase() : active.nativeLabel}
        </span>
        <ChevronDown
          size={compact ? 12 : 14}
          className={`text-bakery-brown/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-56 overflow-hidden rounded-xl border border-bakery-beige bg-white py-1 shadow-xl z-[120]`}
        >
          {APP_LANGUAGE_OPTIONS.map(option => {
            const selected = option.code === lang;
            return (
              <li key={option.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLang(option.code);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-3 ${
                    selected
                      ? 'bg-bakery-beige text-bakery-brown font-bold'
                      : 'text-bakery-brown/70 hover:bg-bakery-cream'
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {option.flag}
                  </span>
                  <span className="flex-1">{t(option.labelKey) || option.nativeLabel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                    {option.code}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
