'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Render as a link to home (default true) */
  asLink?: boolean;
  /** Show the "DynaX" wordmark next to the mark */
  showWord?: boolean;
  /** Mark size in px (height) */
  size?: number;
  className?: string;
  /** Use the light (white) wordmark — for dark backgrounds */
  light?: boolean;
}

/**
 * DynaX brand logo.
 * Renders /images/logo.png if present; otherwise falls back to a crisp
 * built-in SVG monogram so the brand never appears broken.
 */
export function Logo({
  asLink = true,
  showWord = true,
  size = 32,
  className,
  light = false,
}: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const mark = imgFailed ? (
    <LogoMark size={size} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE.logo}
      alt={`${SITE.name} logo`}
      height={size}
      style={{ height: size, width: 'auto' }}
      onError={() => setImgFailed(true)}
      className="object-contain"
    />
  );

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {mark}
      {showWord && (
        <span
          className={cn(
            'font-display font-bold tracking-tight',
            light ? 'text-white' : 'text-slate-900'
          )}
          style={{ fontSize: size * 0.62 }}
        >
          Dyna<span className="dynax-gradient-text">X</span>
        </span>
      )}
    </span>
  );

  if (!asLink) return content;
  return (
    <Link href="/" aria-label={`${SITE.name} home`}>
      {content}
    </Link>
  );
}

/** Standalone SVG monogram — also the fallback mark. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="dx-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#dx-grad)" />
      {/* Stylised D + dynamic motion stroke */}
      <path
        d="M14 13h7.5c6.4 0 11 4.6 11 11s-4.6 11-11 11H14V13z"
        fill="white"
        fillOpacity="0.16"
      />
      <path
        d="M16 16v16M16 16h5.5c4.7 0 8.5 3.6 8.5 8s-3.8 8-8.5 8H16"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 17l-9 14"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default Logo;
