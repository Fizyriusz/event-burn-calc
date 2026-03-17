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
  const [eventNames, setEventNames] = useState<string[]>([]);
  
  // Global Filters
  const [timeframe, setTimeframe] = useState<string>('ALL_TIME');
  const [leaderboardMetric, setLeaderboardMetric] = useState<string>('RAW_SCORE');

  // Trend Chart Filters
  const [selectedAlliance, setSelectedAlliance] = useState<string>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<string>('RAW_SCORE');
  
  // History Chart Filters
  const [historyAlliance, setHistoryAlliance] = useState<string>('');
  const [historyEvent, setHistoryEvent] = useState<string>('');

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
        leaderboard_entries(player_name, score, alliance_tag, day_number)
      `)
      .order('date', { ascending: true });

    if (instancesData) {
      setData(instancesData);
      
      const uniqueAlliances = new Set<string>();
      const uniqueEvents = new Set<string>();
      
      instancesData.forEach((inst: any) => {
        if (inst.event_templates?.name) uniqueEvents.add(inst.event_templates.name);
        inst.leaderboard_entries?.forEach((entry: any) => {
          uniqueAlliances.add(entry.alliance_tag || 'N/A');
        });
      });
      
      const allies = Array.from(uniqueAlliances).sort();
      const events = Array.from(uniqueEvents).sort();
      
      setAlliances(allies);
      setEventNames(events);
      
      if (allies.length > 0) setHistoryAlliance(allies[0]);
      if (events.length > 0) setHistoryEvent(events[0]);
    }
    setLoading(false);
  };

  const filteredData = useMemo(() => {
    if (timeframe === 'ALL_TIME') return data;
    
    const now = new Date();
    const daysToSubtract = timeframe === '7_DAYS' ? 7 : (timeframe === '30_DAYS' ? 30 : 90);
    const cutoffDate = new Date(now.setDate(now.getDate() - daysToSubtract));
    
    return data.filter(d => new Date(d.date) >= cutoffDate);
  }, [data, timeframe]);

  // Obliczanie Leaderboards (Alliance i Player)
  const { topAlliances, topPlayers } = useMemo(() => {
    const allianceStats: Record<string, { rawScore: number, burnEstimates: Record<string, number> }> = {};
    const playerStats: Record<string, { alliance: string, rawScore: number, burnEstimates: Record<string, number> }> = {};
    
    filteredData.forEach(instance => {
       const pointConfigs = instance.event_templates?.event_point_configs || [];
       
       instance.leaderboard_entries?.forEach((entry: any) => {
          const tag = entry.alliance_tag || 'N/A';
          const pName = entry.player_name || 'Unknown';
          
          if (!allianceStats[tag]) allianceStats[tag] = { rawScore: 0, burnEstimates: {} };
          if (!playerStats[pName]) playerStats[pName] = { alliance: tag, rawScore: 0, burnEstimates: {} };
          
          allianceStats[tag].rawScore += entry.score;
          playerStats[pName].rawScore += entry.score;
          
          const cfg = pointConfigs.find((c: any) => c.day_number === entry.day_number || c.day_number === 0) || pointConfigs[0];
          if (cfg && cfg.points_required > 0) {
             const itemName = cfg.item_name;
             const burn = Math.floor(entry.score / cfg.points_required);
             allianceStats[tag].burnEstimates[itemName] = (allianceStats[tag].burnEstimates[itemName] || 0) + burn;
             playerStats[pName].burnEstimates[itemName] = (playerStats[pName].burnEstimates[itemName] || 0) + burn;
          }
       });
    });

    const formatBurns = (burns: Record<string, number>) => {
      const sorted = Object.entries(burns).sort((a,b) => b[1] - a[1]).slice(0, 3);
      if (sorted.length === 0) return 'None';
      return sorted.map(([item, count]) => `${Intl.NumberFormat('en-US').format(count)} ${item}`).join(' + ');
    };

    const getSortValue = (stats: any) => {
       if (leaderboardMetric === 'RAW_SCORE') return stats.rawScore;
       return stats.burnEstimates[leaderboardMetric] || 0;
    };

    const alliancesArr = Object.entries(allianceStats).map(([tag, stats]) => ({
       tag,
       rawScore: stats.rawScore,
       sortValue: getSortValue(stats),
       burnSummary: formatBurns(stats.burnEstimates)
    })).sort((a, b) => b.sortValue - a.sortValue);

    const playersArr = Object.entries(playerStats).map(([name, stats]) => ({
       name,
       alliance: stats.alliance,
       rawScore: stats.rawScore,
       sortValue: getSortValue(stats),
       burnSummary: formatBurns(stats.burnEstimates)
    })).sort((a, b) => b.sortValue - a.sortValue).slice(0, 50); // Top 50

    return { topAlliances: alliancesArr, topPlayers: playersArr };
  }, [filteredData, leaderboardMetric]);


  // Trend Chart (Globalny)
  const chartData = useMemo(() => {
    return filteredData.map((instance: any) => {
      const dataPoint: any = {
        name: `${instance.event_templates?.name} (${instance.date})`,
        date: instance.date
      };

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


  // Historical Alliance Event Chart (Specific Event over All Time)
  const historyChartData = useMemo(() => {
    if (!historyAlliance || !historyEvent) return [];
    
    return data.filter(d => d.event_templates?.name === historyEvent).map((instance: any) => {
      const dp: any = {
        name: instance.date,
        rawScore: 0,
        itemsBurned: 0
      };

      const pointConfigs = instance.event_templates?.event_point_configs || [];

      instance.leaderboard_entries?.forEach((entry: any) => {
         const tag = entry.alliance_tag || 'N/A';
         if (tag === historyAlliance) {
            dp.rawScore += entry.score;
            const cfg = pointConfigs.find((c: any) => c.day_number === entry.day_number || c.day_number === 0) || pointConfigs[0];
            if (cfg && cfg.points_required > 0) {
               dp.itemsBurned += Math.floor(entry.score / cfg.points_required);
            }
         }
      });

      return dp;
    });
  }, [data, historyAlliance, historyEvent]);

  // Utylity
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
          <h2>Global Leaderboard Filters</h2>
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
              <option value="90_DAYS">Last 3 Months</option>
              <option value="30_DAYS">Last 30 Days</option>
              <option value="7_DAYS">Last 7 Days</option>
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Calculate / Sort By</label>
            <select 
              className="input-field" 
              value={leaderboardMetric} 
              onChange={(e) => setLeaderboardMetric(e.target.value)}
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
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* TOP ALLIANCES */}
        <section className="glass-panel animate-slide-up delay-100">
          <div className="section-header">
            <h2>Top Alliances</h2>
            <span className="badge">Aggregated Data</span>
          </div>
          
          {loading ? (
             <p className="text-muted">Loading...</p>
          ) : topAlliances.length === 0 ? (
             <p className="text-muted">No data available for this timeframe.</p>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Alliance</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Value ({leaderboardMetric === 'RAW_SCORE' ? 'Pts' : leaderboardMetric})</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Burn Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {topAlliances.map((alliance, idx) => (
                    <tr key={alliance.tag} style={{ borderBottom: idx < topAlliances.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>[{alliance.tag}]</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                        {Intl.NumberFormat('en-US').format(alliance.sortValue)}
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

        {/* TOP PLAYERS */}
        <section className="glass-panel animate-slide-up delay-200">
          <div className="section-header">
            <h2>Top 50 Players</h2>
            <span className="badge">Individuals</span>
          </div>
          
          {loading ? (
             <p className="text-muted">Loading...</p>
          ) : topPlayers.length === 0 ? (
             <p className="text-muted">No data available.</p>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '12px' }}>Player</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Value ({leaderboardMetric === 'RAW_SCORE' ? 'Pts' : leaderboardMetric})</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>Burn Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((player, idx) => (
                    <tr key={player.name} style={{ borderBottom: idx < topPlayers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)'}}>
                         <div style={{ fontWeight: 'bold' }}>{player.name}</div>
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>[{player.alliance}]</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                        {Intl.NumberFormat('en-US').format(player.sortValue)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--danger-color)', fontSize: '0.8rem' }}>
                        {player.burnSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="glass-panel animate-slide-up delay-200" style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <h2>Historical Alliance Performance</h2>
          <span className="badge">Deep Dive</span>
        </div>
        <p className="text-muted">See how an alliance performed in specific recurring events over time.</p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px', marginBottom: '20px' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Target Alliance</label>
            <select 
              className="input-field" 
              value={historyAlliance} 
              onChange={(e) => setHistoryAlliance(e.target.value)}
            >
              {alliances.map(tag => (
                <option key={tag} value={tag}>[{tag}]</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label">Target Event</label>
            <select 
              className="input-field" 
              value={historyEvent} 
              onChange={(e) => setHistoryEvent(e.target.value)}
            >
              {eventNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</div>
        ) : historyChartData.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No matching data found for this alliance and event.
          </div>
        ) : (
          <div style={{ width: '100%', height: 300, marginTop: '30px' }}>
            <ResponsiveContainer>
              <LineChart data={historyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  tick={{fill: 'var(--text-secondary)', fontSize: 12}} 
                  stroke="rgba(255,255,255,0.2)"
                />
                <YAxis 
                  yAxisId="left"
                  tick={{fill: 'var(--accent-primary)', fontSize: 12}} 
                  stroke="rgba(255,255,255,0.2)"
                  tickFormatter={(val) => Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val)}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{fill: 'var(--danger-color)', fontSize: 12}} 
                  stroke="rgba(255,255,255,0.2)"
                  tickFormatter={(val) => Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  formatter={(value: any, name: any) => [
                    Intl.NumberFormat('en-US').format(Number(value)), 
                    name === 'rawScore' ? 'Points Scored' : 'Est. Items Burned'
                  ]}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="rawScore" name="Raw Points Scored" stroke="var(--accent-primary)" strokeWidth={3} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="itemsBurned" name="Equivalent Items Burned" stroke="var(--danger-color)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="glass-panel animate-slide-up delay-200">
        <div className="section-header">
          <h2>Global Trend Analysis</h2>
          <span className="badge">Bar Chart</span>
        </div>

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
                  tick={{fill: 'var(--text-secondary)', fontSize: 12}} 
                  stroke="rgba(255,255,255,0.2)"
                />
                <YAxis 
                  tick={{fill: 'var(--text-secondary)', fontSize: 12}} 
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
