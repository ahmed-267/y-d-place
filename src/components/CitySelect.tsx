import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { citiesForCountry } from '../data/citiesByCountry';

interface CitySelectProps {
  countryCode: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  className?: string;
}

/** Searchable city select backed by the full country city list. */
export const CitySelect: React.FC<CitySelectProps> = ({
  countryCode,
  value,
  onChange,
  placeholder = 'City',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const cities = useMemo(() => citiesForCountry(countryCode), [countryCode]);

  const filtered = useMemo(() => {
    const q = (open ? query : value).trim().toLowerCase();
    if (!q) return cities.slice(0, 80);
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 120);
  }, [cities, open, query, value]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        className="w-full p-3 sm:p-4 pr-12 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold text-sm sm:text-base text-bakery-brown"
        value={open ? query : value}
        onFocus={() => {
          setOpen(true);
          setQuery(value);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      <ChevronDown
        size={18}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-bakery-brown/50 pointer-events-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-bakery-beige bg-white shadow-xl">
          {filtered.map((city) => (
            <li key={city}>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm font-bold text-bakery-brown hover:bg-bakery-beige/40"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(city);
                  setQuery(city);
                  setOpen(false);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-bakery-brown/40">
        {cities.length} cities available — type to search
      </p>
    </div>
  );
};
