import React from 'react';

interface GeoAgriLogoProps {
  size?: number;
  className?: string;
}

export const GeoAgriLogo: React.FC<GeoAgriLogoProps> = ({ size = 26, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`geo-agri-logo ${className}`}
      aria-label="GeoAgri AI Global Agriculture Logo"
    >
      <defs>
        <linearGradient id="logoGlobeGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--info)" />
          <stop offset="100%" stopColor="var(--emerald-500)" />
        </linearGradient>
        <linearGradient id="logoLeafGrad" x1="16" y1="48" x2="48" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--emerald-500)" />
          <stop offset="50%" stopColor="var(--emerald-300)" />
          <stop offset="100%" stopColor="var(--gold-300)" />
        </linearGradient>
        <linearGradient id="logoLeafSubGrad" x1="32" y1="44" x2="52" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--emerald-500)" />
          <stop offset="100%" stopColor="var(--emerald-300)" />
        </linearGradient>
        <linearGradient id="logoOrbitGrad" x1="6" y1="32" x2="58" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--info)" stopOpacity="0.8" />
          <stop offset="50%" stopColor="var(--emerald-300)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--info)" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Globe Base Sphere */}
      <circle cx="32" cy="32" r="26" fill="url(#logoGlobeGrad)" />

      {/* Geodesic Curves */}
      <ellipse cx="32" cy="32" rx="13" ry="26" stroke="var(--ink-1)" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
      <ellipse cx="32" cy="32" rx="26" ry="11" stroke="var(--ink-1)" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
      <line x1="6" y1="32" x2="58" y2="32" stroke="var(--ink-1)" strokeOpacity="0.28" strokeWidth="1.5" />
      <line x1="32" y1="6" x2="32" y2="58" stroke="var(--ink-1)" strokeOpacity="0.28" strokeWidth="1.5" />

      {/* Geospatial Orbit Ring */}
      <ellipse cx="32" cy="32" rx="30" ry="13" transform="rotate(-26 32 32)" stroke="url(#logoOrbitGrad)" strokeWidth="2.2" strokeDasharray="3 2" fill="none" />
      <circle cx="58" cy="22" r="3.2" fill="var(--info)" />
      <circle cx="58" cy="22" r="1.5" fill="var(--ink-1)" />

      {/* Primary Sprouting Leaf (Agriculture Core) */}
      <path d="M32 50 C26 38, 20 28, 24 16 C34 16, 42 24, 32 50 Z" fill="url(#logoLeafGrad)" />
      <path d="M30 46 C27 36, 26 26, 28 20" stroke="var(--emerald-500)" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Secondary Companion Sprout */}
      <path d="M31 38 C36 32, 45 28, 46 22 C46 30, 40 37, 31 38 Z" fill="url(#logoLeafSubGrad)" />

      {/* Golden Radiance Node */}
      <circle cx="24" cy="16" r="2.2" fill="var(--gold-500)" />
    </svg>
  );
};

export default GeoAgriLogo;
