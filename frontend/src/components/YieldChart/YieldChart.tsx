import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface YieldChartProps {
  crops: FullReportResponse['recommended_crops'];
}

export const YieldChart: React.FC<YieldChartProps> = ({ crops }) => {
  const chartData = crops.slice(0, 7).map(c => ({
    name: c.crop_name,
    P10: c.expected_yield_t_ha.p10,
    P50: c.expected_yield_t_ha.p50,
    P90: c.expected_yield_t_ha.p90,
  }));

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp style={{ color: '#10b981' }} size={20} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Yield Quantiles Comparison (Tonnes / Ha)</h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Visualizing yield uncertainty bounds across top candidates: P10 (Pessimistic), P50 (Expected), P90 (Optimistic).</p>

      <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" t/ha" />
            <Tooltip
              contentStyle={{ background: '#131a29', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              labelStyle={{ color: '#ffffff', fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="P10" fill="#f87171" name="P10 (10th percentile)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="P50" fill="#10b981" name="P50 (Median expected)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="P90" fill="#60a5fa" name="P90 (90th percentile)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
