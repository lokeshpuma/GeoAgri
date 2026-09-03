import React, { useState } from 'react';
import { Search, ArrowUpDown, Info } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface CropTableProps {
  crops: FullReportResponse['recommended_crops'];
}

export const CropTable: React.FC<CropTableProps> = ({ crops }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'recommendation_score' | 'p50_yield' | 'water_need'>('recommendation_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredCrops = crops.filter(crop =>
    crop.crop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crop.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCrops = [...filteredCrops].sort((a, b) => {
    let valA = 0;
    let valB = 0;
    if (sortField === 'recommendation_score') {
      valA = a.recommendation_score;
      valB = b.recommendation_score;
    } else if (sortField === 'p50_yield') {
      valA = a.expected_yield_t_ha.p50;
      valB = b.expected_yield_t_ha.p50;
    } else if (sortField === 'water_need') {
      valA = a.water_need_mm;
      valB = b.water_need_mm;
    }
    return sortDirection === 'desc' ? valB - valA : valA - valB;
  });

  const toggleSort = (field: 'recommendation_score' | 'p50_yield' | 'water_need') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Ranked Crop Recommendations (100+ Crop Plan)</h3>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Optimized for balanced suitability, yield, water cost, and climate risk resilience.</p>
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search crop or category..."
            className="form-control"
            style={{ paddingLeft: '36px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#131a29', color: '#9ca3af', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '12px 16px' }}>Rank & Crop Name</th>
              <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSort('recommendation_score')}>
                Score <ArrowUpDown size={12} />
              </th>
              <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSort('p50_yield')}>
                Expected Yield (P10/P50/P90) <ArrowUpDown size={12} />
              </th>
              <th style={{ padding: '12px 16px' }}>Est. Production (P50)</th>
              <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSort('water_need')}>
                Water Need & Mode <ArrowUpDown size={12} />
              </th>
              <th style={{ padding: '12px 16px' }}>Climate Risk</th>
              <th style={{ padding: '12px 16px' }}>Rationale</th>
            </tr>
          </thead>
          <tbody>
            {sortedCrops.map((crop, idx) => (
              <tr
                key={crop.crop_id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                }}
              >
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ffffff' }}>
                  <span style={{ color: '#10b981', marginRight: '8px' }}>#{idx + 1}</span>
                  {crop.crop_name}
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 400, textTransform: 'capitalize' }}>
                    {crop.category} • {crop.data_confidence} confidence
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#34d399' }}>
                  {(crop.recommendation_score * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <strong>{crop.expected_yield_t_ha.p50}</strong> t/ha
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>
                    P10: {crop.expected_yield_t_ha.p10} | P90: {crop.expected_yield_t_ha.p90}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fbbf24' }}>
                  {crop.expected_production_t.p50} Tonnes
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className={`badge ${crop.irrigation_mode === 'rainfed' ? 'badge-high' : (crop.irrigation_mode === 'supplemental' ? 'badge-moderate' : 'badge-low')}`}>
                    {crop.irrigation_mode}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                    {crop.water_need_mm} mm
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: crop.climate_risk_score < 35 ? '#34d399' : (crop.climate_risk_score < 60 ? '#fbbf24' : '#f87171'), fontWeight: 600 }}>
                    {crop.climate_risk_score.toFixed(0)}%
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#d1d5db', maxWidth: '300px' }}>
                  {crop.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
