import React from "react";
import { Award, CheckCircle2, ChevronRight, Leaf, Sprout, TrendingUp } from "lucide-react";
import { FullReportResponse } from "../../api/client";

interface CropSuitabilityRankingProps {
  crops: FullReportResponse['recommended_crops'];
  farmArea?: number;
}

export const CropSuitabilityRanking: React.FC<CropSuitabilityRankingProps> = ({ crops = [], farmArea = 5 }) => {
  if (!crops || crops.length === 0) {
    return null;
  }

  const top3 = crops.slice(0, 3);

  const rankClasses = ["pill-rank1", "pill-rank2", "pill-rank3"];
  const rankLabels = ["RANK #1", "RANK #2", "RANK #3"];

  return (
    <div style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sprout size={20} style={{ color: "#10b981" }} />
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Top Companion Intercrop Pairings
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: 0 }}>
              Optimized 75% Main Crop + 25% Companion Intercrop spatial land allocation
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "4px 12px",
            background: "rgba(16, 185, 129, 0.15)",
            color: "#6ee7b7",
            borderRadius: "20px",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontWeight: 600
          }}
        >
          Top 3 Agronomic Synergies
        </span>
      </div>

      {/* 3 Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {top3.map((crop, idx) => {
          const mainYieldPerHa = crop.expected_yield_t_ha?.p50 || 2.5;
          const mainArea = farmArea * 0.75;
          const intercropArea = farmArea * 0.25;

          const mainTotalYield = Number((mainYieldPerHa * mainArea).toFixed(2));

          let intercropName = "Cowpea (Lobia)";
          let yieldBoostPct = 14.5;
          let companionShareFactor = 0.25;

          if (crop.intercrop_options && crop.intercrop_options.length > 0) {
            const opt = crop.intercrop_options[0];
            intercropName = opt.companion_crop_name;
            yieldBoostPct = Number((opt.yield_boost_pct * 100).toFixed(1));
            companionShareFactor = opt.companion_share_factor || 0.25;
          }

          const intercropYieldPerHa = Number((mainYieldPerHa * 0.58).toFixed(2));
          const intercropTotalYield = Number((intercropYieldPerHa * intercropArea).toFixed(2));
          const combinedYield = Number((mainTotalYield + intercropTotalYield).toFixed(2));
          const sustainability = 12 - idx * 2;
          const matchPercent = Math.min(100, Math.round(crop.recommendation_score * 100));

          return (
            <div
              key={crop.crop_id || idx}
              className="glass-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                position: "relative",
                borderTop: idx === 0 ? "3px solid #10b981" : idx === 1 ? "3px solid #3b82f6" : "3px solid #f59e0b"
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: idx === 0 ? "rgba(16, 185, 129, 0.2)" : idx === 1 ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: idx === 0 ? "#34d399" : idx === 1 ? "#60a5fa" : "#fbbf24",
                      display: "inline-block",
                      marginBottom: 4
                    }}
                  >
                    {rankLabels[idx]}
                  </span>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    {crop.crop_name}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "capitalize" }}>
                    {crop.category} • {crop.irrigation_mode}
                  </span>
                </div>

                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    borderRadius: 8,
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                >
                  <div style={{ fontSize: "0.65rem", color: "#9ca3af" }}>Yield Boost</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#34d399" }}>
                    +{yieldBoostPct}%
                  </div>
                </div>
              </div>

              {/* Companion Intercrop Tag */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Leaf size={14} style={{ color: "#34d399" }} />
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Companion Partner:</span>
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f3f4f6" }}>
                  {intercropName}
                </span>
              </div>

              {/* Production Metrics */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  background: "rgba(0, 0, 0, 0.25)",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Main Production (75%)</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                    {mainTotalYield} <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>tonnes</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Intercrop Extra (25%)</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#a7f3d0" }}>
                    +{intercropTotalYield} <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>tonnes</span>
                  </div>
                </div>
                <div style={{ gridColumn: "span 2", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Total Combined Output:</span>
                    <span style={{ fontSize: "1rem", fontWeight: 800, color: "#fbbf24" }}>
                      {combinedYield} tonnes
                    </span>
                  </div>
                </div>
              </div>

              {/* Suitability Match Progress Bar */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "#9ca3af" }}>Suitability Match</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{matchPercent}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.08)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${matchPercent}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10b981, #34d399)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
