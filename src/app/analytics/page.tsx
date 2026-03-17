'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [alliances, setAlliances] = useState<string[]>([]);

  // Filtry
  const [selectedAlliance, setSelectedAlliance] = useState<string>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<string>('RAW_SCORE');
  const [timeframe, setTimeframe] = useState<string>('ALL_TIME');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    // Pobieramy wszystkie instancje eventów wraz z wynikami, posortowane historycznie
    const { data: instancesData } = await supabase
      .from('event_instances')
      .select(`
        id,
        date,
        event_templates(name, type, event_point_configs(item_name, points_required, day_number)),
        leaderboard_entries(score, alliance_tag, day_number)
      `)
      .order('date', { ascending: true });

    if (instancesData) {
      setData(instancesData);

      // Wydobądź unikalne tagi sojuszy
      const uniqueAlliances = new Set<string>();
      instancesData.forEach((inst: any) => {
        inst.leaderboard_entries?.forEach((entry: any) => {
          uniqueAlliances.add(entry.alliance_tag || 'N/A');
        });
      });
      setAlliances(Array.from(uniqueAlliances).sort());
    }
    setLoading(false);
  };

  const filteredData = useMemo(() => {
    if (timeframe === 'ALL_TIME') return data;

    const now = new Date();
    const daysToSubtract = timeframe === '7_DAYS' ? 7 : 30;
    const cutoffDate = new Date(now.setDate(now.getDate() - daysToSubtract));

    return data.filter(d => new Date(d.date) >= cutoffDate);
  }, [data, timeframe]);

  // Przetwarzanie danych pod wykres
  const chartData = useMemo(() => {
    return filteredData.map((instance: any) => {
      // Przygotowanie punktu na osi X
      const dataPoint: any = {
        name: `${instance.event_templates?.name} (${instance.date})`,
        date: instance.date
      };

      // Sumowanie scores per odpowiedni filtr
      let totalValue = 0;
      let isMetricFound = false;

      const pointConfigs = instance.event_templates?.event_point_configs || [];

      instance.leaderboard_entries?.forEach((entry: any) => {
        const tag = entry.alliance_tag || 'N/A';
        if (selectedAlliance === 'ALL' || selectedAlliance === tag) {
          if (selectedMetric === 'RAW_SCORE') {
            totalValue += entry.score;
            isMetricFound = true;
          } else {
            // Jeśli szukamy konkretnego itemu
            const cfg = pointConfigs.find((c: any) => c.item_name === selectedMetric && (c.day_number === entry.day_number || c.day_number === 0));
            if (cfg && cfg.points_required > 0) {
              totalValue += Math.floor(entry.score / cfg.points_required);
              isMetricFound = true;
            }
          }
        }
      });

      if (!isMetricFound && selectedMetric !== 'RAW_SCORE') return null;

      dataPoint.value = totalValue;
      return dataPoint;
    }).filter(item => item !== null);
  }, [filteredData, selectedAlliance, selectedMetric]);


  // Obliczanie Leaderboarda dla wybranego Timeframe
  const leaderboardData = useMemo(() => {
    const allianceStats: Record<string, { rawScore: number, itemsCountKey: string, burnEstimates: Record<string, number> }> = {};

    filteredData.forEach(instance => {
      const pointConfigs = instance.event_templates?.event_point_configs || [];

      instance.leaderboard_entries?.forEach((entry: any) => {
        const tag = entry.alliance_tag || 'N/A';
        if (!allianceStats[tag]) {
          allianceStats[tag] = { rawScore: 0, itemsCountKey: '', burnEstimates: {} };
        }

        allianceStats[tag].rawScore += entry.score;

        const cfg = pointConfigs.find((c: any) => c.day_number === entry.day_number || c.day_number === 0) || pointConfigs[0];
        if (cfg && cfg.points_required > 0) {
          const itemName = cfg.item_name;
          allianceStats[tag].burnEstimates[itemName] = (allianceStats[tag].burnEstimates[itemName] || 0) + Math.floor(entry.score / cfg.points_required);
        }
      });
    });

    return Object.entries(allianceStats).map(([tag, stats]) => {
      // Build a short summary of burns
      const topBurns = Object.entries(stats.burnEstimates)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([item, count]) => `${Intl.NumberFormat('en-US').format(count)} ${item}`)
        .join(' + ');

      return {
        tag,
        rawScore: stats.rawScore,
        burnSummary: topBurns || 'None'
      };
    }).sort((a, b) => b.rawScore - a.rawScore);

  }, [filteredData]);


  // Unikalne itemy po których można filtrować
  const uniqueItems = useMemo(() => {
    const items = new Set<string>();
    data.forEach(inst => {
      inst.event_templates?.event_point_configs?.forEach((cfg: any) => {
        items.add(cfg.item_name);
      });
    });
    return Array.from(items).sort();
  }, [data]);

  return (
    <div className="dashboard-container">
      <section className="glass-panel animate-slide-up delay-100" style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <h2>Global Filters</h2>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Timeframe</label>
            <select
              className="input-field"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="ALL_TIME">All Time</option>
              <option value="30_DAYS">Last 30 Days</option>
              <option value="7_DAYS">Last 7 Days</option>
            </select>
          </div>
        </div>
      </section>

      <section className="glass-panel animate-slide-up delay-100" style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <h2>Top Alliances Leaderboard</h2>
          <span className="badge">Aggregated Data</span>
        </div>
        <p className="text-muted" style={{ marginBottom: '16px' }}>Ranking for the selected timeframe ({timeframe.replace('_', ' ').toLowerCase()}).</p>

        {loading ? (
          <p className="text-muted">Loading...</p>
        ) : leaderboardData.length === 0 ? (
          <p className="text-muted">No data available for this timeframe.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Rank</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Alliance</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Total Points</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Est. Items Burned</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((alliance, idx) => (
                  <tr key={alliance.tag} style={{ borderBottom: idx < leaderboardData.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>#{idx + 1}</td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>[{alliance.tag}]</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                      {Intl.NumberFormat('en-US').format(alliance.rawScore)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--danger-color)', fontSize: '0.8rem' }}>
                      {alliance.burnSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-panel animate-slide-up delay-200">
        <div className="section-header">
          <h2>Trend Analysis</h2>
          <span className="badge">Beta</span>
        </div>
        <p className="text-muted">Analyze how many resources your alliances are burning over time.</p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px', marginBottom: '20px' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Filter by Alliance</label>
            <select
              className="input-field"
              value={selectedAlliance}
              onChange={(e) => setSelectedAlliance(e.target.value)}
            >
              <option value="ALL">All Alliances Combined</option>
              {alliances.map(tag => (
                <option key={tag} value={tag}>[{tag}] Alliance</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Metric to Visualize</label>
            <select
              className="input-field"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              <option value="RAW_SCORE">Raw Score (Total Points)</option>
              <optgroup label="Specific Items (Burned)">
                {uniqueItems.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading analytics data...</div>
        ) : chartData.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Not enough data to draw a trend. Try selecting a different metric or timeframe.
          </div>
        ) : (
          <div style={{ width: '100%', height: 400, marginTop: '30px' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  stroke="rgba(255,255,255,0.2)"
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  stroke="rgba(255,255,255,0.2)"
                  tickFormatter={(val) => Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}
                  formatter={(value: any) => [Intl.NumberFormat('en-US').format(Number(value)), selectedMetric === 'RAW_SCORE' ? 'Total Points' : 'Items Burned']}
                />
                <Bar
                  dataKey="value"
                  name={selectedMetric === 'RAW_SCORE' ? 'Total Points Gained' : `${selectedMetric} Burned`}
                  fill="var(--accent-primary)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
