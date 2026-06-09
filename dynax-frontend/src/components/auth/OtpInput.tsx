'use client';

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
}

/** Segmented 6-box one-time-code input with paste + arrow support. */
export function OtpInput({ value, onChange, onComplete, length = 6 }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.split('').slice(0, length);

  const setChar = (idx: number, char: string) => {
    const next = value.split('');
    next[idx] = char;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    return joined;
  };

  const handleChange = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const joined = setChar(idx, digit);
    if (idx < length - 1) refs.current[idx + 1]?.focus();
    if (joined.length === length && !joined.includes('') ) onComplete?.(joined);
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[idx]) {
        setChar(idx, '');
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        setChar(idx - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const target = Math.min(pasted.length, length - 1);
    refs.current[target]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          maxLength={1}
          value={chars[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            'h-12 w-10 sm:h-14 sm:w-12 rounded-xl border-2 text-center text-xl font-bold text-slate-900 outline-none transition',
            chars[i] ? 'border-dynax-blue bg-blue-50/40' : 'border-slate-200',
            'focus:border-dynax-blue focus:ring-2 focus:ring-blue-100'
          )}
        />
      ))}
    </div>
  );
}

export default OtpInput;
