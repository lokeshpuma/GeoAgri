import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAPS } from './mapStyles';

export interface BoundaryPreviewMapProps {
  polygon: [number, number][];
  point?: [number, number];
  height?: string | number;
}

export const BoundaryPreviewMap: React.FC<BoundaryPreviewMapProps> = ({
  polygon,
  point,
  height = '320px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS.satellite.style,
      center: point || (polygon.length > 0 ? polygon[0] : [0, 20]),
      zoom: 14,
      interactive: true,
      attributionControl: false,
    });

    map.on('load', () => {
      if (polygon.length >= 3) {
        map.addSource('preview-polygon', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [polygon],
            },
          },
        });

        map.addLayer({
          id: 'preview-polygon-fill',
          type: 'fill',
          source: 'preview-polygon',
          paint: {
            'fill-color': '#22c58b',
            'fill-opacity': 0.28,
          },
        });

        map.addLayer({
          id: 'preview-polygon-line',
          type: 'line',
          source: 'preview-polygon',
          paint: {
            'line-color': '#22c58b',
            'line-width': 2.5,
          },
        });

        // Fit bounds to polygon
        const bounds = new maplibregl.LngLatBounds();
        polygon.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
      } else if (point) {
        new maplibregl.Marker({ color: '#22c58b' }).setLngLat(point).addTo(map);
        map.flyTo({ center: point, zoom: 15 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [polygon, point]);

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
        position: 'relative',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(5, 9, 10, 0.75)',
          padding: '2px 8px',
          borderRadius: 'var(--r-xs)',
          fontSize: '0.6875rem',
          color: 'var(--ink-3)',
          pointerEvents: 'none',
        }}
      >
        Verified Field Extent
      </div>
    </div>
  );
};
