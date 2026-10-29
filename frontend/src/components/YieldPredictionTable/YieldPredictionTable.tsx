import React, { useState } from 'react';
import { Table, Layers, X, Leaf } from 'lucide-react';
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
    <div className="glass-card yield-pred-table-wrap">
      <div className="yield-pred-header">
        <div>
          <div className="yield-pred-title-group">
            <Table size={20} className="text-emerald" />
            <h3 className="yield-pred-title">
              Top 10 Regional Yield Benchmarks
            </h3>
          </div>
          <p className="yield-pred-subtitle">
            Prioritized by median regional yield benchmark (P50), intercrop synergy, and regional environmental compatibility (national statistics; not field adjusted).
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
        <table className="report-table yield-pred-tbl">
          <thead>
            <tr>
              <th className="yield-pred-th">Rank</th>
              <th className="yield-pred-th">Crop</th>
              <th className="yield-pred-th">Companion Crop</th>
              <th className="yield-pred-th right">Expected Yield P50</th>
              <th className="yield-pred-th right">Yield Range P10–P90</th>
              <th className="yield-pred-th center">Yield Boost</th>
              <th className="yield-pred-th center">Irrigation</th>
              <th className="yield-pred-th right">Suitability</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((crop, idx) => {
              const p50Yield = crop.expected_yield_t_ha?.p50;
              const p10Yield = crop.expected_yield_t_ha?.p10;
              const p90Yield = crop.expected_yield_t_ha?.p90;

              const totalTonnes = crop.expected_production_t?.p50 != null
                ? crop.expected_production_t.p50.toFixed(1)
                : (p50Yield != null ? (p50Yield * farmArea).toFixed(1) : null);

              const companion = crop.intercrop_options?.[0];
              const boostPct = companion ? (companion.yield_boost_pct * 100).toFixed(1) : null;

              const suitability = (crop.recommendation_score * 100).toFixed(1);

              return (
                <tr key={crop.crop_id || idx} className="yield-pred-tr">
                  <td className="yield-pred-td">
                    <span className={`yield-pred-rank-badge ${idx < 3 ? 'top' : ''}`}>
                      {idx + 1}
                    </span>
                  </td>

                  <td className="yield-pred-td">
                    <strong className="yield-pred-crop-name">{crop.crop_name}</strong>
                    <div className="yield-pred-crop-cat">
                      {crop.category} {crop.confidence_tier ? `• Tier ${crop.confidence_tier}` : ''}
                    </div>
                  </td>

                  <td className="yield-pred-td">
                    {companion ? (
                      <div className="yield-pred-companion-cell">
                        <Leaf size={13} className="text-emerald flex-shrink-0" />
                        <span>{companion.companion_crop_name}</span>
                      </div>
                    ) : (
                      <div className="text-ink-3">
                        None (Sole)
                      </div>
                    )}
                  </td>

                  <td className="yield-pred-td right">
                    {totalTonnes != null ? (
                      <>
                        <div className="yield-pred-total-tonnes">
                          {totalTonnes} t
                        </div>
                        <span className="yield-pred-rate">{p50Yield!.toFixed(2)} t/ha</span>
                      </>
                    ) : (
                      <span className="text-ink-3">No yield data</span>
                    )}
                  </td>

                  <td className="yield-pred-td right yield-pred-range">
                    {p10Yield != null && p90Yield != null ? (
                      `${p10Yield.toFixed(2)} – ${p90Yield.toFixed(2)} t/ha`
                    ) : (
                      <span className="text-ink-3">Envelope match</span>
                    )}
                  </td>

                  <td className="yield-pred-td center">
                    {boostPct !== null ? (
                      <span className="yield-pred-boost">
                        +{boostPct}%
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>

                  <td className="yield-pred-td center">
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

                  <td className="yield-pred-td right">
                    <strong className="yield-pred-score">{suitability}%</strong>
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
                <h2 className="yield-pred-modal-title">
                  Master 100+ Crop Recommendation Matrix
                </h2>
                <p className="yield-pred-modal-subtitle">
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
