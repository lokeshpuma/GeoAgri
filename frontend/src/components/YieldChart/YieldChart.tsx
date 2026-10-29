import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { FullReportResponse } from '../../api/client';
import { YIELD_CHART_COLORS } from '../../theme/palette';

interface YieldChartProps {
  crops: FullReportResponse['recommended_crops'];
}

export const YieldChart: React.FC<YieldChartProps> = ({ crops }) => {
  const chartData = crops
    .filter(c => c.expected_yield_t_ha != null)
    .slice(0, 7)
    .map(c => ({
      name: c.crop_name,
      P10: c.expected_yield_t_ha!.p10,
      P50: c.expected_yield_t_ha!.p50,
      P90: c.expected_yield_t_ha!.p90,
    }));

  return (
    <div className="glass-card yield-chart-container">
      <div className="flex-row-center gap-8">
        <TrendingUp className="text-emerald" size={20} />
        <h3 className="yield-chart-title">Regional Yield Benchmark Comparison (Tonnes / Ha)</h3>
      </div>
      <p className="yield-chart-desc">Regional yield benchmarks (FAOSTAT, crop-level): P10, P50, and P90 ranges based on national statistics; not adjusted to your field.</p>

      <div className="yield-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <XAxis dataKey="name" stroke={YIELD_CHART_COLORS.tooltipBorderDark} tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
            <YAxis stroke={YIELD_CHART_COLORS.tooltipBorderDark} tick={{ fontSize: 11 }} unit=" t/ha" />
            <Tooltip
              contentStyle={{ background: YIELD_CHART_COLORS.tooltipBgDark, border: YIELD_CHART_COLORS.tooltipBorderDark, borderRadius: '8px' }}
              labelStyle={{ color: 'var(--ink-1)', fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="P10" fill={YIELD_CHART_COLORS.p10} name="P10 (10th percentile)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="P50" fill={YIELD_CHART_COLORS.p50} name="P50 (Median expected)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="P90" fill={YIELD_CHART_COLORS.p90} name="P90 (90th percentile)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
