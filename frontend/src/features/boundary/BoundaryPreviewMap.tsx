import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UNIFIED_MAP_STYLE } from './mapStyles';
import { THEME_HEX } from '../../theme/palette';

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
      style: UNIFIED_MAP_STYLE,
      center: point || (polygon.length > 0 ? polygon[0] : [0, 20]),
      zoom: 14,
      maxZoom: 22,
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
            'fill-color': THEME_HEX.emerald,
            'fill-opacity': 0.28,
          },
        });

        map.addLayer({
          id: 'preview-polygon-line',
          type: 'line',
          source: 'preview-polygon',
          paint: {
            'line-color': THEME_HEX.emerald,
            'line-width': 2.5,
          },
        });

        // Fit bounds to polygon
        const bounds = new maplibregl.LngLatBounds();
        polygon.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
      } else if (point) {
        new maplibregl.Marker({ color: THEME_HEX.markerDefault }).setLngLat(point).addTo(map);
        map.flyTo({ center: point, zoom: 15 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [polygon, point]);

  return (
    <div className="boundary-preview-container" style={{ height }}>
      <div ref={containerRef} className="boundary-preview-canvas" style={{ width: '100%', height: '100%' }} />
      <div className="boundary-preview-badge">
        Verified Field Extent
      </div>
    </div>
  );
};
