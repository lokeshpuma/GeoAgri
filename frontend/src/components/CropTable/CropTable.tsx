import React, { useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
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
      valA = a.expected_yield_t_ha?.p50 ?? 0;
      valB = b.expected_yield_t_ha?.p50 ?? 0;
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
    <div className="glass-card crop-tbl-container">
      <div className="crop-tbl-header">
        <div>
          <h3 className="crop-tbl-title">Ranked Crop Recommendations (100+ Crop Plan)</h3>
          <p className="crop-tbl-subtitle">Optimized for balanced suitability, yield, water cost, and climate risk resilience.</p>
        </div>

        <div className="crop-tbl-search-box">
          <Search size={16} className="crop-tbl-search-icon" />
          <input
            type="text"
            placeholder="Search crop or category..."
            className="form-control crop-tbl-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="crop-tbl-scroll">
        <table className="crop-tbl-table">
          <thead>
            <tr>
              <th className="crop-tbl-th">Rank & Crop Name</th>
              <th className="crop-tbl-th clickable" onClick={() => toggleSort('recommendation_score')}>
                <div className="flex-row-center gap-4">
                  Score <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="crop-tbl-th clickable" onClick={() => toggleSort('p50_yield')}>
                <div className="flex-row-center gap-4">
                  Expected Yield (P10/P50/P90) <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="crop-tbl-th">Est. Production (P50)</th>
              <th className="crop-tbl-th clickable" onClick={() => toggleSort('water_need')}>
                <div className="flex-row-center gap-4">
                  Water Need & Mode <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="crop-tbl-th">Climate Risk</th>
              <th className="crop-tbl-th">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {sortedCrops.map((crop, idx) => {
              const riskColorClass = crop.climate_risk_score < 35 ? 'text-emerald-light' : crop.climate_risk_score < 60 ? 'text-gold' : 'text-danger';

              return (
                <tr key={crop.crop_id} className="crop-tbl-tr">
                  <td className="crop-tbl-td font-semibold text-ink-1">
                    <span className="text-emerald mr-2">#{idx + 1}</span>
                    {crop.crop_name}
                    <span className="crop-tbl-meta">
                      {crop.category} • {crop.data_confidence} confidence
                    </span>
                  </td>
                  <td className="crop-tbl-td font-bold text-emerald-light">
                    {(crop.recommendation_score * 100).toFixed(1)}%
                  </td>
                  <td className="crop-tbl-td">
                    {crop.expected_yield_t_ha ? (
                      <>
                        <strong>{crop.expected_yield_t_ha.p50}</strong> t/ha
                        <span className="crop-tbl-range">
                          P10: {crop.expected_yield_t_ha.p10} | P90: {crop.expected_yield_t_ha.p90}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-3">No yield data</span>
                    )}
                  </td>
                  <td className="crop-tbl-td font-semibold text-gold">
                    {crop.expected_production_t ? `${crop.expected_production_t.p50} Tonnes` : '—'}
                  </td>
                  <td className="crop-tbl-td">
                    <span className={`badge ${crop.irrigation_mode === 'rainfed' ? 'badge-high' : (crop.irrigation_mode === 'supplemental' ? 'badge-moderate' : 'badge-low')}`}>
                      {crop.irrigation_mode}
                    </span>
                    <span className="crop-tbl-water">
                      {crop.water_need_mm} mm
                    </span>
                  </td>
                  <td className="crop-tbl-td">
                    <span className={`${riskColorClass} font-semibold`}>
                      {crop.climate_risk_score.toFixed(0)}%
                    </span>
                  </td>
                  <td className="crop-tbl-td crop-tbl-rationale">
                    {crop.rationale}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
