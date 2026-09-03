import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, RotateCcw, Layers } from 'lucide-react';
import { fetchFieldArea } from '../../api/client';

// Fix default marker icon issue in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapSelectorProps {
  onPolygonChange: (polygon: [number, number][], areaHa: number) => void;
  onPointChange: (point: [number, number]) => void;
}

const PRESET_REGIONS = [
  {
    name: "Telangana Field (Cotton/Maize)",
    centroid: [17.3850, 78.4867] as [number, number],
    polygon: [
      [78.4850, 17.3850],
      [78.4870, 17.3850],
      [78.4870, 17.3870],
      [78.4850, 17.3870],
      [78.4850, 17.3850]
    ] as [number, number][]
  },
  {
    name: "Punjab Field (Wheat/Paddy)",
    centroid: [30.9010, 75.8573] as [number, number],
    polygon: [
      [75.8550, 30.9000],
      [75.8600, 30.9000],
      [75.8600, 30.9040],
      [75.8550, 30.9040],
      [75.8550, 30.9000]
    ] as [number, number][]
  },
  {
    name: "Maharashtra Field (Sugarcane/Soybean)",
    centroid: [19.8762, 75.3433] as [number, number],
    polygon: [
      [75.3400, 19.8740],
      [75.3460, 19.8740],
      [75.3460, 19.8790],
      [75.3400, 19.8790],
      [75.3400, 19.8740]
    ] as [number, number][]
  }
];

function LocationMarker({ onSelectPoint }: { onSelectPoint: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onSelectPoint(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onPolygonChange, onPointChange }) => {
  const [polygonPts, setPolygonPts] = useState<[number, number][]>(PRESET_REGIONS[0].polygon);
  const [areaHa, setAreaHa] = useState<number>(2.35);
  const [center, setCenter] = useState<[number, number]>(PRESET_REGIONS[0].centroid);

  const handleSelectPreset = async (preset: typeof PRESET_REGIONS[0]) => {
    setPolygonPts(preset.polygon);
    setCenter(preset.centroid);
    try {
      const res = await fetchFieldArea(preset.polygon);
      setAreaHa(res.area_ha);
      onPolygonChange(preset.polygon, res.area_ha);
    } catch {
      onPolygonChange(preset.polygon, 2.35);
    }
  };

  const handlePointClick = (lat: number, lng: number) => {
    onPointChange([lng, lat]);
  };

  // Convert (lon, lat) to (lat, lon) for Leaflet rendering
  const leafletPoly: [number, number][] = polygonPts.map(([lon, lat]) => [lat, lon]);

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers style={{ color: '#10b981' }} size={20} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Field Polygon & Satellite Selector</h3>
        </div>
        <span className="badge badge-high">
          {areaHa.toFixed(2)} Ha Geodesic Area
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {PRESET_REGIONS.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSelectPreset(preset)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#131a29',
              color: '#d1d5db',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            📍 {preset.name}
          </button>
        ))}
      </div>

      <div style={{ height: '380px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {leafletPoly.length > 0 && (
            <Polygon
              positions={leafletPoly}
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, weight: 3 }}
            />
          )}
          <LocationMarker onSelectPoint={handlePointClick} />
        </MapContainer>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
        💡 Click anywhere on map to drop a point or select a preset region to automatically load field bounds.
      </p>
    </div>
  );
};
