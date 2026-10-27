import React, { useState } from "react";
import {
  ArrowUpDown,
  Download,
  Search,
  Leaf,
  Layers,
} from "lucide-react";
import { FullReportResponse } from "../../api/client";

interface MultiCroppingTableProps {
  crops: FullReportResponse['recommended_crops'];
  farmArea?: number;
}

export const MultiCroppingTable: React.FC<MultiCroppingTableProps> = ({ crops = [], farmArea = 5 }) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("score");
  const [sortAsc, setSortAsc] = useState(false);

  if (!crops || crops.length === 0) {
    return null;
  }

  // Build rows with intercropping calculations
  const rows = crops.map((crop, idx) => {
    const mainYieldPerHa = crop.expected_yield_t_ha?.p50 || 2.5;
    const hasIntercrop = Boolean(crop.intercrop_options && crop.intercrop_options.length > 0);

    let intercropName = crop.intercrop_data_available === false ? "Data not yet available" : "None (Sole Crop)";
    let yieldBoost = 0;
    let companionShare = 0.0;

    if (hasIntercrop) {
      const opt = crop.intercrop_options[0];
      intercropName = opt.companion_crop_name;
      yieldBoost = Number((opt.yield_boost_pct * 100).toFixed(1));
      companionShare = opt.companion_share_factor || 0.25;
    }

    const mainShare = hasIntercrop ? (1.0 - companionShare) : 1.0;
    const mainArea = farmArea * mainShare;
    const intercropArea = farmArea * companionShare;

    const mainTotalYield = Number((mainYieldPerHa * mainArea).toFixed(2));
    const intercropYieldPerHa = hasIntercrop ? Number((mainYieldPerHa * 0.58).toFixed(2)) : 0;
    const intercropTotalYield = hasIntercrop ? Number((intercropYieldPerHa * intercropArea).toFixed(2)) : 0;
    const combinedYield = Number((mainTotalYield + intercropTotalYield).toFixed(2));
    const score = Number((crop.recommendation_score * 100).toFixed(1));

    return {
      id: crop.crop_id || String(idx),
      mainCrop: crop.crop_name,
      intercrop: intercropName,
      hasIntercrop,
      mainYieldPerHa,
      mainTotalYield,
      intercropYieldPerHa,
      intercropTotalYield,
      combinedYield,
      yieldBoost,
      score,
      category: crop.category,
      irrigation: crop.irrigation_mode || "Supplemental",
    };
  });

  const filtered = rows.filter(
    (r) =>
      r.mainCrop.toLowerCase().includes(search.toLowerCase()) ||
      r.intercrop.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Main Crop",
      "Intercrop Companion",
      "Main Yield (t/ha)",
      "Main Production (t)",
      "Intercrop Yield (t/ha)",
      "Intercrop Production (t)",
      "Combined Production (t)",
      "Intercrop Yield Advantage (%)",
      "Recommendation Score",
      "Category",
      "Irrigation Mode"
    ];

    const csvRows = [headers.join(",")];

    sorted.forEach((r) => {
      csvRows.push(
        [
          `"${r.mainCrop}"`,
          `"${r.intercrop}"`,
          r.mainYieldPerHa,
          r.mainTotalYield,
          r.intercropYieldPerHa,
          r.intercropTotalYield,
          r.combinedYield,
          r.hasIntercrop ? `"+${r.yieldBoost}%"` : '"N/A (Sole Crop)"',
          r.score,
          `"${r.category}"`,
          `"${r.irrigation}"`
        ].join(",")
      );
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geoagri_intercropping_plan_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card multi-crop-table-wrap">
      {/* Header & Controls */}
      <div className="multi-crop-top-row">
        <div>
          <div className="multi-crop-heading-group">
            <Layers size={20} className="text-emerald" />
            <h3 className="multi-crop-title">
              Multi-Cropping Land Allocation & Yield Matrix
            </h3>
          </div>
          <p className="multi-crop-desc">
            75% Main Crop Area ({Number((farmArea * 0.75).toFixed(2))} ha) + 25% Companion Crop Area ({Number((farmArea * 0.25).toFixed(2))} ha)
          </p>
        </div>

        {/* Search & Export Buttons */}
        <div className="multi-crop-ctrl-row">
          <div className="multi-crop-search-wrap">
            <Search size={14} className="multi-crop-search-icon" />
            <input
              type="text"
              placeholder="Search crop or companion..."
              className="form-control multi-crop-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={exportCSV}
            className="multi-crop-export-btn"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="multi-crop-scroll">
        <table className="multi-crop-tbl">
          <thead>
            <tr>
              <th className="multi-crop-th clickable" onClick={() => handleSort("mainCrop")}>
                <div className="flex-row-center gap-4">
                  Main Crop <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="multi-crop-th clickable" onClick={() => handleSort("intercrop")}>
                <div className="flex-row-center gap-4">
                  Companion Crop (25%) <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="multi-crop-th right">Main Yield (t)</th>
              <th className="multi-crop-th right">Companion Yield (t)</th>
              <th className="multi-crop-th right clickable" onClick={() => handleSort("combinedYield")}>
                <div className="flex-row-center justify-between gap-4">
                  Combined (t) <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="multi-crop-th right clickable" onClick={() => handleSort("yieldBoost")}>
                <div className="flex-row-center justify-between gap-4">
                  Yield Boost <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="multi-crop-th center">Irrigation</th>
              <th className="multi-crop-th right clickable" onClick={() => handleSort("score")}>
                <div className="flex-row-center justify-between gap-4">
                  Score <ArrowUpDown size={12} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const irrigClass = r.irrigation.toLowerCase() === "rainfed"
                ? "rainfed"
                : r.irrigation.toLowerCase() === "supplemental"
                ? "supplemental"
                : "other";

              return (
                <tr key={r.id} className="multi-crop-tr">
                  <td className="multi-crop-td">
                    <div className="multi-crop-main-name">{r.mainCrop}</div>
                    <div className="multi-crop-main-cat">{r.category}</div>
                  </td>
                  <td className="multi-crop-td">
                    {r.hasIntercrop ? (
                      <div className="multi-crop-companion-group">
                        <Leaf size={12} className="text-emerald-light" />
                        <span className="multi-crop-companion-name">{r.intercrop}</span>
                      </div>
                    ) : (
                      <span className="text-ink-3">None (Sole)</span>
                    )}
                  </td>
                  <td className="multi-crop-td right text-ink-1">
                    {r.mainTotalYield} <span className="text-ink-3">({r.mainYieldPerHa} t/ha)</span>
                  </td>
                  <td className={`multi-crop-td right ${r.hasIntercrop ? 'text-emerald-light' : 'text-ink-3'}`}>
                    {r.hasIntercrop ? `+${r.intercropTotalYield}` : "—"}
                  </td>
                  <td className="multi-crop-td right text-gold-light">
                    {r.combinedYield} t
                  </td>
                  <td className="multi-crop-td right">
                    {r.hasIntercrop ? (
                      <span className="multi-crop-boost-tag">
                        +{r.yieldBoost}%
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="multi-crop-td center">
                    <span className={`multi-crop-irrig-tag ${irrigClass}`}>
                      {r.irrigation}
                    </span>
                  </td>
                  <td className="multi-crop-td right text-ink-1">
                    {r.score}
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
