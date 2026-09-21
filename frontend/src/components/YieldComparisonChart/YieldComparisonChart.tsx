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

  const top3 = crops.slice(0, 3);

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={20} style={{ color: "#10b981" }} />
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Standalone vs. Companion Intercropped Production
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>
              Visualizing baseline yield compared with additional harvest gained from symbiotic intercropping
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "3px 10px",
            background: "rgba(255, 255, 255, 0.06)",
            color: "#9ca3af",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Units: Metric Tonnes (t)
        </span>
      </div>

      {/* Comparison Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {top3.map((crop, idx) => {
          const mainYieldPerHa = crop.expected_yield_t_ha?.p50 || 2.5;
          const mainArea = farmArea * 0.75;
          const intercropArea = farmArea * 0.25;

          const mainTotalYield = Number((mainYieldPerHa * mainArea).toFixed(2));

          let intercropName = "Cowpea (Lobia)";
          if (crop.intercrop_options && crop.intercrop_options.length > 0) {
            intercropName = crop.intercrop_options[0].companion_crop_name;
          }

          const intercropYieldPerHa = mainYieldPerHa * 0.58;
          const intercropTotalYield = Number((intercropYieldPerHa * intercropArea).toFixed(2));
          const combinedYield = Number((mainTotalYield + intercropTotalYield).toFixed(2));
          const maxVal = Math.max(...top3.map(c => ((c.expected_yield_t_ha?.p50 || 2.5) * farmArea * 0.75 * 1.5)), combinedYield * 1.2, 1);

          const mainPct = Math.min(100, Math.round((mainTotalYield / maxVal) * 100));
          const intercropPct = Math.min(100, Math.round((intercropTotalYield / maxVal) * 100));

          return (
            <div
              key={crop.crop_id || idx}
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                padding: 14,
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ffffff" }}>
                    {crop.crop_name}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 600 }}>
                    + {intercropName}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fbbf24" }}>
                    {combinedYield} t
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: 4 }}>
                    combined output
                  </span>
                </div>
              </div>

              {/* Stacked Bar */}
              <div
                style={{
                  height: 12,
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "flex",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: `${mainPct}%`,
                    height: "100%",
                    background: "#3b82f6",
                    transition: "width 0.4s ease",
                  }}
                  title={`Main Crop: ${mainTotalYield} t`}
                />
                <div
                  style={{
                    width: `${intercropPct}%`,
                    height: "100%",
                    background: "#10b981",
                    transition: "width 0.4s ease",
                  }}
                  title={`Intercrop Companion: +${intercropTotalYield} t`}
                />
              </div>

              {/* Legend for this bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                    Main ({crop.crop_name}): <strong style={{ color: "#ffffff", marginLeft: 2 }}>{mainTotalYield} t</strong>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    Companion ({intercropName}): <strong style={{ color: "#34d399", marginLeft: 2 }}>+{intercropTotalYield} t</strong>
                  </span>
                </div>
                <span style={{ color: "#34d399", fontWeight: 600 }}>
                  +{(crop.intercrop_options?.[0]?.yield_boost_pct ? (crop.intercrop_options[0].yield_boost_pct * 100).toFixed(1) : 14.5)}% Advantage
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
