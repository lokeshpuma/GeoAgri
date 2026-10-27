import React from "react";
import { BarChart3 } from "lucide-react";
import { FullReportResponse } from "../../api/client";

interface YieldComparisonChartProps {
  crops: FullReportResponse['recommended_crops'];
  farmArea?: number;
}

export const YieldComparisonChart: React.FC<YieldComparisonChartProps> = ({ crops = [], farmArea = 5 }) => {
  if (!crops || crops.length === 0) {
    return null;
  }

  const top5 = crops.slice(0, 5);

  return (
    <div className="glass-card yield-comp-chart-wrap">
      {/* Header */}
      <div className="yield-comp-header">
        <div className="flex-row-center gap-8">
          <BarChart3 size={20} className="text-emerald" />
          <div>
            <h3 className="yield-comp-title">
              Multi-Crop & Intercrop Compatibility
            </h3>
            <p className="yield-comp-desc">
              Standalone vs. Companion Intercropped Production — Visualizing main crop baseline harvest with companion yield synergies
            </p>
          </div>
        </div>
        <span className="yield-comp-unit-tag">
          Units: Metric Tonnes (t)
        </span>
      </div>

      {/* Comparison Rows */}
      <div className="yield-comp-rows">
        {top5.map((crop, idx) => {
          const mainYieldPerHa = crop.expected_yield_t_ha?.p50 || 2.5;
          const hasIntercrop = Boolean(crop.intercrop_options && crop.intercrop_options.length > 0);

          let intercropName = "";
          let companionShare = 0.0;
          if (hasIntercrop) {
            const opt = crop.intercrop_options[0];
            intercropName = opt.companion_crop_name;
            companionShare = opt.companion_share_factor || 0.25;
          }

          const mainShare = hasIntercrop ? (1.0 - companionShare) : 1.0;
          const mainArea = farmArea * mainShare;
          const intercropArea = farmArea * companionShare;

          const mainTotalYield = Number((mainYieldPerHa * mainArea).toFixed(2));
          const intercropYieldPerHa = hasIntercrop ? (mainYieldPerHa * 0.58) : 0;
          const intercropTotalYield = hasIntercrop ? Number((intercropYieldPerHa * intercropArea).toFixed(2)) : 0;
          const combinedYield = Number((mainTotalYield + intercropTotalYield).toFixed(2));
          const maxVal = Math.max(...top5.map((c: any) => ((c.expected_yield_t_ha?.p50 || 2.5) * farmArea * 1.2)), combinedYield * 1.2, 1);

          const mainPct = Math.min(100, Math.round((mainTotalYield / maxVal) * 100));
          const intercropPct = hasIntercrop ? Math.min(100, Math.round((intercropTotalYield / maxVal) * 100)) : 0;

          return (
            <div key={crop.crop_id || idx} className="yield-comp-row-card">
              <div className="yield-comp-row-top">
                <div className="flex-row-center gap-8">
                  <span className="yield-comp-crop-title">
                    {crop.crop_name}
                  </span>
                  {hasIntercrop ? (
                    <span className="yield-comp-companion-title">
                      + {intercropName}
                    </span>
                  ) : (
                    <span className="yield-comp-sole-title">
                      (Sole Cropping)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="yield-comp-combined-output">
                    {combinedYield} t
                  </span>
                  <span className="yield-comp-combined-label">
                    combined output
                  </span>
                </div>
              </div>

              {/* Stacked Bar */}
              <div className="yield-comp-bar-track">
                <div
                  className="yield-comp-bar-main"
                  style={{ width: `${mainPct}%` }}
                  title={`Main Crop: ${mainTotalYield} t`}
                />
                <div
                  className="yield-comp-bar-companion"
                  style={{ width: `${intercropPct}%` }}
                  title={`Intercrop Companion: +${intercropTotalYield} t`}
                />
              </div>

              {/* Legend for this bar */}
              <div className="yield-comp-legend">
                <div className="flex-row-center gap-16">
                  <span className="flex-row-center gap-6">
                    <span className="yield-comp-legend-dot-main" />
                    Main ({crop.crop_name}): <strong className="text-ink-1 ml-2">{mainTotalYield} t</strong>
                  </span>
                  {hasIntercrop && (
                    <span className="flex-row-center gap-6">
                      <span className="yield-comp-legend-dot-companion" />
                      Companion ({intercropName}): <strong className="text-emerald-light ml-2">+{intercropTotalYield} t</strong>
                    </span>
                  )}
                </div>
                {hasIntercrop && crop.intercrop_options?.[0]?.yield_boost_pct && (
                  <span className="yield-comp-advantage-text">
                    +{(crop.intercrop_options[0].yield_boost_pct * 100).toFixed(1)}% Advantage
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
