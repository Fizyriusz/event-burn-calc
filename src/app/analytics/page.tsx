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
        event_templates(name, type, event_point_configs(item_name, points_required)),
        leaderboard_entries(score, alliance_tag)
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

  // Przetwarzanie danych pod wykres
  const chartData = useMemo(() => {
    return data.map((instance: any) => {
      // Przygotowanie punktu na osi X
      const dataPoint: any = {
        name: `${instance.event_templates?.name} (${instance.date})`,
        date: instance.date
      };

      // Sumowanie scores per odpowiedni filtr
      let totalValue = 0;
      
      // Zbierz dane dla wybranego przelicznika, jeśli nie jest to RAW_SCORE
      let pointsDivider = 1;
      const pointConfigs = instance.event_templates?.event_point_configs || [];
      if (selectedMetric !== 'RAW_SCORE') {
         const matchingConfig = pointConfigs.find((c: any) => c.item_name === selectedMetric);
         if (matchingConfig) pointsDivider = matchingConfig.points_required;
         else return null; // Jeśli ten event nie punktował na ten zbadany konkretnie przedmiot - pomiń z wykresu trendu
      }

      instance.leaderboard_entries?.forEach((entry: any) => {
        const tag = entry.alliance_tag || 'N/A';
        if (selectedAlliance === 'ALL' || selectedAlliance === tag) {
          totalValue += entry.score;
        }
      });

      // Zapisujemy wyliczoną w oparciu o filtry wartość do osi Y
      dataPoint.value = Math.floor(totalValue / pointsDivider);

      return dataPoint;
    }).filter(item => item !== null); // Wyrzuć eventy z null (takie, które nie posiadały przelicznika z badanego przedmiotu)
  }, [data, selectedAlliance, selectedMetric]);


  // Unikalne itemy po których można filtrować (z konfiguracji szablonów)
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
      <section className="glass-panel animate-slide-up delay-100">
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
            Not enough data to draw a trend. Try selecting a different metric.
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
