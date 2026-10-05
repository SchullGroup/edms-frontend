'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icons';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

/** Password field with a show/hide toggle — shared by every auth screen. */
export function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  required,
  autoFocus,
  id,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full pr-10"
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute bg-transparent border-0 inset-y-0 right-2 cursor-pointer flex items-center px-3 text-(--muted) hover:text-(--ink)"
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}
