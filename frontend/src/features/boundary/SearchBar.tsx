import React, { useState, useEffect, useRef } from 'react';
import { Search, Navigation, X, MapPin } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { useToast } from '../../ui/Toast';

export interface SearchBarProps {
  onFlyTo: (coords: [number, number], zoom?: number) => void;
  onDropSearchMarker?: (coords: [number, number]) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onFlyTo, onDropSearchMarker }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ name: string; coords: [number, number] }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  /**
   * Parse coordinates like:
   * "13.32, 75.75", "13.32°N 75.75°E", "13.3200,-75.7500"
   */
  const parseCoordinates = (text: string): [number, number] | null => {
    const clean = text.trim();
    // Pattern with degrees/cardinals: 13.32°N, 75.75°E
    const dmsRegex = /([0-9.]+)\s*°?\s*([NSns])?[,\s]+([0-9.]+)\s*°?\s*([EWew])?/;
    const dmsMatch = clean.match(dmsRegex);
    if (dmsMatch) {
      let lat = parseFloat(dmsMatch[1]);
      const latHem = (dmsMatch[2] || '').toUpperCase();
      if (latHem === 'S') lat = -lat;

      let lng = parseFloat(dmsMatch[3]);
      const lngHem = (dmsMatch[4] || '').toUpperCase();
      if (lngHem === 'W') lng = -lng;

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lng, lat];
      }
    }

    // Pattern simple: lat, lng
    const simpleRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    if (simpleRegex.test(clean)) {
      const parts = clean.split(/[,\s]+/).map(parseFloat);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [lat, lng] = parts;
        return [lng, lat];
      }
    }

    return null;
  };

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const coords = parseCoordinates(query);
    if (coords) {
      setResults([
        {
          name: `Coordinates: ${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E`,
          coords,
        },
      ]);
      setShowDropdown(true);
      return;
    }

    const geocoderUrl = import.meta.env.VITE_GEOCODER_URL;
    if (!geocoderUrl) {
      // No geocoder configured, show hint
      setResults([
        {
          name: 'Search by coordinates (e.g. "13.3200, 75.7500")',
          coords: [0, 0],
        },
      ]);
      setShowDropdown(true);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${geocoderUrl}?q=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.features || []).map((f: any) => ({
            name: f.properties?.label || f.properties?.name || 'Unknown place',
            coords: f.geometry?.coordinates as [number, number],
          }));
          setResults(items);
          setShowDropdown(true);
        }
      } catch (err) {
        console.warn('Geocoder request failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSelect = (coords: [number, number]) => {
    if (coords[0] === 0 && coords[1] === 0) return;
    onFlyTo(coords, 16);
    if (onDropSearchMarker) onDropSearchMarker(coords);
    setShowDropdown(false);
    showToast({
      type: 'info',
      title: 'Navigated to location',
      message: `${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E`,
      durationMs: 3000,
    });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast({
        type: 'error',
        title: 'Geolocation unavailable',
        message: 'Your browser does not support GPS location.',
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        onFlyTo(coords, 16);
        if (onDropSearchMarker) onDropSearchMarker(coords);
        showToast({
          type: 'success',
          title: 'Current Location',
          message: `Accuracy: ±${Math.round(pos.coords.accuracy)}m`,
        });
      },
      err => {
        setIsLocating(false);
        showToast({
          type: 'warn',
          title: 'Location access denied',
          message: err.message || 'Please enable browser location access or paste coordinates.',
        });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-panel)',
        width: 'min(460px, 92vw)',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--glass-strong)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--elev-2)',
        }}
      >
        <Search size={18} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search place or paste lat, lng..."
          aria-label="Search map location"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--ink-1)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-ui)',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const coords = parseCoordinates(query);
              if (coords) handleSelect(coords);
              else if (results.length > 0) handleSelect(results[0].coords);
            }
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--ink-3)',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        )}
        <div style={{ width: '1px', height: '18px', background: 'var(--glass-border)' }} />
        <IconButton
          icon={<Navigation size={16} />}
          aria-label="Locate me"
          variant="ghost"
          size="sm"
          disabled={isLocating}
          onClick={handleLocateMe}
          style={{
            color: isLocating ? 'var(--emerald-500)' : 'var(--ink-2)',
          }}
        />
      </div>

      {showDropdown && results.length > 0 && (
        <div
          className="glass-panel animate-fade-rise"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'var(--bg-1)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--elev-3)',
            maxHeight: '240px',
            overflowY: 'auto',
            padding: '6px',
          }}
        >
          {results.map((r, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(r.coords)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSelect(r.coords);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: 'var(--r-xs)',
                cursor: r.coords[0] === 0 ? 'default' : 'pointer',
                color: 'var(--ink-1)',
                fontSize: '0.8125rem',
                transition: 'background var(--t-fast) var(--ease-out)',
              }}
              onMouseEnter={e => {
                if (r.coords[0] !== 0) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <MapPin size={16} style={{ color: 'var(--emerald-500)', flexShrink: 0 }} />
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
