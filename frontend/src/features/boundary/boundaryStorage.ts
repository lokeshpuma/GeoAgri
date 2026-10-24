import { BoundaryState } from './boundaryTypes';

const STORAGE_KEY = 'geoagri.boundary.v1';

export function saveBoundaryDraft(state: Partial<BoundaryState>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      mode: state.mode || 'none',
      polygon: state.polygon || null,
      pin: state.pin || null,
      name: state.name || '',
      areaHa: state.areaHa || null,
      areaSource: state.areaSource || null,
      confirmed: state.confirmed || false,
      source: state.source || 'drawn',
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save boundary draft to localStorage:', err);
  }
}

export function loadBoundaryDraft(): Partial<BoundaryState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.polygon || parsed.pin)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Corrupt boundary draft in localStorage, clearing:', err);
    clearBoundaryDraft();
  }
  return null;
}

export function clearBoundaryDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear boundary draft:', err);
  }
}
