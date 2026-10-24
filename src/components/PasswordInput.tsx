import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Preserves native input/autofill behaviour; revealing never submits the form. */
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className = '', id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [visible, setVisible] = useState(false);
    return <div className="relative w-full">
      <input {...props} ref={ref} id={inputId} type={visible ? 'text' : 'password'} className={`${className} !pr-12`} />
      <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
        aria-controls={inputId} disabled={props.disabled} onClick={() => setVisible(value => !value)}
        className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-bakery-brown/60 hover:text-bakery-brown focus-visible:outline-2 focus-visible:outline-bakery-caramel disabled:opacity-40">
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>;
  }
);
