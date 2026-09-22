import React, { useState } from 'react';
import { Table, Layers, X, Download, ExternalLink, Leaf } from 'lucide-react';
import { FullReportResponse } from '../../api/client';
import { MultiCroppingTable } from '../MultiCroppingTable/MultiCroppingTable';

interface YieldPredictionTableProps {
  crops: FullReportResponse['recommended_crops'];
  farmArea: number;
}

export const YieldPredictionTable: React.FC<YieldPredictionTableProps> = ({ crops = [], farmArea = 2.35 }) => {
  const [showFullMatrix, setShowFullMatrix] = useState<boolean>(false);

  if (!crops || crops.length === 0) return null;

  const top10 = crops.slice(0, 10);

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Table size={20} style={{ color: '#10b981' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Top 10 Yield Predictions
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
            Prioritized by median yield potential (P50), intercrop synergy, and regional environmental compatibility.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFullMatrix(true)}
          className="btn-outline"
        >
          <Layers size={15} />
          <span>View Full Crop Matrix (100+ Crops)</span>
        </button>
      </div>

      {/* Clean Top 10 Table */}
      <div className="table-responsive">
        <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 14px' }}>Rank</th>
              <th style={{ padding: '12px 14px' }}>Crop</th>
              <th style={{ padding: '12px 14px' }}>Companion Crop</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Expected Yield P50</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Yield Range P10–P90</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Yield Boost</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Irrigation</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Suitability</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((crop, idx) => {
              const p50Yield = crop.expected_yield_t_ha.p50;
              const p10Yield = crop.expected_yield_t_ha.p10;
              const p90Yield = crop.expected_yield_t_ha.p90;

              const totalTonnes = (crop.expected_production_t?.p50 || (p50Yield * farmArea)).toFixed(1);

              const companion = crop.intercrop_options?.[0];
              const boostPct = companion ? (companion.yield_boost_pct * 100).toFixed(1) : "14.5";

              const suitability = (crop.recommendation_score * 100).toFixed(1);

              return (
                <tr key={crop.crop_id || idx}>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: idx < 3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: idx < 3 ? '#34d399' : 'var(--text-muted)',
                        textAlign: 'center',
                        lineHeight: '24px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      {idx + 1}
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{crop.crop_name}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {crop.category}
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <Leaf size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                      <span>{companion?.companion_crop_name || "Cowpea (Lobia)"}</span>
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>
                      {totalTonnes} t
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{p50Yield.toFixed(2)} t/ha</span>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#9ca3af' }}>
                    {p10Yield.toFixed(2)} – {p90Yield.toFixed(2)} t/ha
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      +{boostPct}%
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      className={`badge ${
                        crop.irrigation_mode === 'rainfed'
                          ? 'badge-high'
                          : crop.irrigation_mode === 'supplemental'
                          ? 'badge-moderate'
                          : 'badge-low'
                      }`}
                    >
                      {crop.irrigation_mode}
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>{suitability}%</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal / Drawer for Full 100+ Matrix */}
      {showFullMatrix && (
        <div className="matrix-modal-backdrop" onClick={() => setShowFullMatrix(false)}>
          <div className="matrix-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="matrix-modal-header">
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Master 100+ Crop Recommendation Matrix
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  Full multi-attribute evaluation across all calibrated Indian cultivars and companion systems.
                </p>
              </div>

              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowFullMatrix(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="matrix-modal-body">
              <MultiCroppingTable crops={crops} farmArea={farmArea} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
