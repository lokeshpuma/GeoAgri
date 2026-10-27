/**
 * Centralized color palette and design tokens for GeoAgri AI.
 * 
 * Per PRD v3.1 Gate G-T1:
 * Raw colors (hex/rgba) must not appear in any TSX file outside this file.
 * All chart palettes, map marker colors, and canvas/SVG colors must be exported from here.
 */

export const THEME_HEX = {
  emerald: '#22c58b',
  emeraldHover: '#1ca875',
  emeraldMuted: '#13302b',
  gold: '#d9ad4f',
  goldHover: '#c49a3f',
  goldMuted: '#352d1c',
  danger: '#ff6b6b',
  warn: '#ffb454',
  info: '#6cb6ff',
  ink1Dark: '#f3f1ea',
  ink2Dark: '#b9c2bd',
  ink3Dark: '#7f8d87',
  bg0Dark: '#05090a',
  bg1Dark: '#0a1112',
  bg2Dark: '#101a1a',
  bg3Dark: '#172524',
  glassDark: 'rgba(16, 26, 26, 0.62)',
  glassBorderDark: 'rgba(255, 255, 255, 0.08)',
  ink1Light: '#0f2a22',
  ink2Light: '#3e5a4f',
  ink3Light: '#6c8378',
  bg0Light: '#f6f3ea',
  bg1Light: '#fbf9f3',
  bg2Light: '#ffffff',
  bg3Light: '#efeadc',
  glassLight: 'rgba(255, 255, 255, 0.72)',
  glassBorderLight: 'rgba(20, 40, 30, 0.10)',
  shadowAmberDark: 'rgba(245, 158, 11, 0.15)',
  shadowAmberLight: '#fef3c7',
  markerDefault: '#22c58b',
  markerActive: '#d9ad4f',
  markerPin: '#ff6b6b',
} as const;

/**
 * Standard palette for Recharts and other data visualizations.
 * Reads computed CSS variables when in the browser, with static fallbacks.
 */
export const CHART_PALETTE = [
  '#22c58b', // emerald
  '#d9ad4f', // gold
  '#6cb6ff', // info
  '#ffb454', // warn
  '#a78bfa', // purple
  '#34d399', // mint
  '#fbbf24', // amber
  '#38bdf8', // sky
  '#f87171', // red
  '#818cf8', // indigo
];

export const YIELD_CHART_COLORS = {
  p50: '#22c58b',
  p10: '#6cb6ff',
  p90: '#d9ad4f',
  baseline: '#ffb454',
  grid: 'rgba(255, 255, 255, 0.08)',
  gridLight: 'rgba(0, 0, 0, 0.08)',
  tooltipBgDark: '#101a1a',
  tooltipBgLight: '#ffffff',
  tooltipBorderDark: 'rgba(255, 255, 255, 0.12)',
  tooltipBorderLight: 'rgba(0, 0, 0, 0.12)',
};

/**
 * Helper to safely extract a CSS variable from document root.
 */
export function getCssToken(tokenName: string, fallback = ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
}
