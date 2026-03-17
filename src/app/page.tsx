'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function EventCard({ instance, isMergeMode, isSelectedForMerge, isPrimaryMerge, onToggleSelection }: { instance: any, isMergeMode: boolean, isSelectedForMerge: boolean, isPrimaryMerge: boolean, onToggleSelection: (id: string) => void }) {
  const isLong = instance.event_templates?.type === 'LONG';

  // Pobieramy wszystkie dostępne konfiguracje (przeliczniki) dla tego eventu
  const pointConfigs = instance.event_templates?.event_point_configs || [];

  // Dostępne dni z leaderboarda
  const availableDays = Array.from(new Set(instance.leaderboard_entries?.map((e: any) => e.day_number) || [0])).sort() as number[];

  const [viewDay, setViewDay] = useState<string>(isLong ? 'ALL' : '0');

  const availableConfigs = pointConfigs.filter((c: any) =>
    viewDay === 'ALL' ? true : (c.day_number === Number(viewDay) || c.day_number === 0)
  );

  const [selectedConfigId, setSelectedConfigId] = useState<string>(availableConfigs[0]?.id || '');

  // Synchronize config when day changes (only for specific day view)
  useEffect(() => {
    if (viewDay !== 'ALL' && availableConfigs.length > 0) {
      if (!availableConfigs.find((c: any) => c.id === selectedConfigId)) {
        setSelectedConfigId(availableConfigs[0].id);
      }
    }
  }, [viewDay, availableConfigs, selectedConfigId]);

  if (!instance.leaderboard_entries || instance.leaderboard_entries.length === 0) {
    return (
      <div className={`glass-panel event-card ${isMergeMode ? 'merge-selectable' : ''}`} onClick={() => isMergeMode && onToggleSelection(instance.id)}>
        <div className="event-card-header">
          <h3>{instance.event_templates?.name || 'Unknown Event'}</h3>
          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-secondary)' }}>
            {instance.date}
          </span>
        </div>
        <p className="text-muted">No statistics available for this event.</p>
        {isMergeMode && (
          <div style={{ marginTop: '10px' }}>
            <input type="checkbox" checked={isSelectedForMerge} readOnly style={{ marginRight: '8px' }} />
            {isPrimaryMerge ? <strong style={{ color: 'var(--accent-primary)' }}>(Primary)</strong> : 'Select to merge'}
          </div>
        )}
      </div>
    );
  }

  // Filter entries
  const filteredEntries = instance.leaderboard_entries.filter((e: any) =>
    viewDay === 'ALL' ? true : e.day_number === Number(viewDay)
  );

  // Grouping
  const alliancePoints: Record<string, number> = {};
  const allianceBurn: Record<string, number> = {};

  filteredEntries.forEach((entry: any) => {
    const tag = entry.alliance_tag || 'N/A';
    alliancePoints[tag] = (alliancePoints[tag] || 0) + entry.score;

    // Calculate Burn
    let burn = 0;
    if (viewDay === 'ALL') {
      // Find default config for this entry's day
      const cfg = pointConfigs.find((c: any) => c.day_number === entry.day_number) || pointConfigs[0];
      if (cfg && cfg.points_required > 0) {
        burn = Math.floor(entry.score / cfg.points_required);
      }
    } else {
      // Use selected config
      const cfg = pointConfigs.find((c: any) => c.id === selectedConfigId) || pointConfigs[0];
      if (cfg && cfg.points_required > 0) {
        burn = Math.floor(entry.score / cfg.points_required);
      }
    }
    allianceBurn[tag] = (allianceBurn[tag] || 0) + burn;
  });

  const sortedAlliances = Object.entries(alliancePoints).sort((a, b) => b[1] - a[1]);
  const itemName = viewDay === 'ALL' ? 'Mixed Items' : (pointConfigs.find((c: any) => c.id === selectedConfigId)?.item_name || 'Items');

  const [expandedAlliance, setExpandedAlliance] = useState<string | null>(null);

  const toggleAlliance = (tag: string) => {
    if (expandedAlliance === tag) setExpandedAlliance(null);
    else setExpandedAlliance(tag);
  };

  return (
    <div 
      className={`glass-panel event-card ${isMergeMode ? 'merge-selectable' : ''}`} 
      style={isSelectedForMerge ? { border: '1px solid var(--accent-primary)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)' } : {}}
      onClick={(e) => {
        // Prevent toggle if interacting with select/buttons
        if (isMergeMode && (e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
           onToggleSelection(instance.id);
        }
      }}
    >
      <div className="event-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isMergeMode && (
            <input type="checkbox" checked={isSelectedForMerge} readOnly style={{ cursor: 'pointer' }} />
          )}
          <h3>{instance.event_templates?.name || 'Unknown Event'}</h3>
        </div>
        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-secondary)' }}>
          {instance.date}
        </span>
      </div>

      {isMergeMode && isSelectedForMerge && (
         <div style={{ padding: '4px 0', fontSize: '0.85rem', color: isPrimaryMerge ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
            {isPrimaryMerge ? '★ Target Container (Primary)' : '⮑ Will be merged into primary'}
         </div>
      )}

      <div className="event-stats">
        {isLong && availableDays.length > 0 && !isMergeMode && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select
              className="input-field"
              style={{ padding: '6px', fontSize: '0.85rem' }}
              value={viewDay}
              onChange={e => setViewDay(e.target.value)}
            >
              <option value="ALL">All Days (Total)</option>
              {availableDays.map(d => (
                <option key={d} value={d}>Day {d}</option>
              ))}
            </select>
          </div>
        )}

        {viewDay !== 'ALL' && availableConfigs.length > 0 && !isMergeMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
            <label className="label" style={{ marginBottom: 0 }}>Convert to:</label>
            <select
              className="input-field"
              style={{ padding: '8px', fontSize: '0.9rem' }}
              value={selectedConfigId}
              onChange={(e) => setSelectedConfigId(e.target.value)}
            >
              {availableConfigs.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.item_name} (1 = {c.points_required} pts)
                </option>
              ))}
            </select>
          </div>
        )}

        <ul className="alliance-list">
          {sortedAlliances.map(([tag, score]) => {
            const isExpanded = expandedAlliance === tag;
            const burn = allianceBurn[tag];
            const alliancePlayers = filteredEntries
              .filter((e: any) => (e.alliance_tag || 'N/A') === tag)
              .sort((a: any, b: any) => b.score - a.score);

            return (
              <li key={tag} className="alliance-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
                  onClick={() => !isMergeMode && toggleAlliance(tag)}
                >
                  <span className="alliance-tag">[{tag}] {!isMergeMode && (isExpanded ? '▼' : '▶')}</span>
                  <div className="alliance-score-details" style={{ textAlign: 'right' }}>
                    <span className="score-raw">{Intl.NumberFormat('en-US').format(score)} pts</span>
                    <span className="score-burn">≈ {Intl.NumberFormat('en-US').format(burn)} burned ({itemName})</span>
                  </div>
                </div>

                {isExpanded && !isMergeMode && (
                  <div className="player-details-dropdown animate-slide-up" style={{ marginTop: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '10px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Contributors</h4>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <tbody>
                        {alliancePlayers.map((player: any, idx: number) => {
                          let playerBurn = 0;
                          if (viewDay === 'ALL') {
                            const cfg = pointConfigs.find((c: any) => c.day_number === player.day_number) || pointConfigs[0];
                            if (cfg && cfg.points_required > 0) playerBurn = Math.floor(player.score / cfg.points_required);
                          } else {
                            const cfg = pointConfigs.find((c: any) => c.id === selectedConfigId) || pointConfigs[0];
                            if (cfg && cfg.points_required > 0) playerBurn = Math.floor(player.score / cfg.points_required);
                          }

                          return (
                            <tr key={player.id} style={{ borderBottom: idx < alliancePlayers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                              <td style={{ padding: '6px 0', color: 'var(--text-primary)' }}>{player.player_name}{viewDay === 'ALL' && ` (Day ${player.day_number})`}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Intl.NumberFormat('en-US').format(player.score)}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', color: 'var(--danger-color)' }}>{playerBurn > 0 ? `-${Intl.NumberFormat('en-US').format(playerBurn)}` : '0'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!isMergeMode && (
          <div className="roast-module">
            <button
              className="btn-roast"
              onClick={() => {
                if (sortedAlliances.length === 0) return;
                const topWhale = sortedAlliances[0];
                const roastText = `Alliance [${topWhale[0]}] complains about lack of preparation, but here they burned the equivalent of ${Intl.NumberFormat('en-US').format(allianceBurn[topWhale[0]])} ${itemName}(s). Great job!`;
                navigator.clipboard.writeText(roastText);
                alert('Copied to clipboard: ' + roastText);
              }}
            >
              🔥 Generate Roast
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [instances, setInstances] = useState<any[]>([]);
  
  // Merge mode states
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    const { data: instancesData } = await supabase
      .from('event_instances')
      .select(`
        *,
        event_templates(name, type, event_point_configs(*)),
        leaderboard_entries(id, player_name, score, alliance_tag, day_number)
      `)
      .order('date', { ascending: false });

    if (instancesData) {
      setInstances(instancesData);
    }
  };

  const toggleMergeSelection = (id: string) => {
    setSelectedForMerge(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      else return [...prev, id];
    });
  };

  const executeMerge = async () => {
    if (selectedForMerge.length < 2) {
      alert('You must select at least 2 instances to merge.');
      return;
    }

    // Pierwszy zaznaczony staje się primary
    const primaryId = selectedForMerge[0];
    const toMergeIds = selectedForMerge.slice(1);

    if (!confirm('Are you sure you want to merge these instances? The other instances will be deleted and their data moved into the primary one. This cannot be undone.')) {
       return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/events/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_instance_id: primaryId, instance_ids_to_merge: toMergeIds }),
      });

      const result = await res.json();
      if (res.ok) {
         setSelectedForMerge([]);
         setIsMergeMode(false);
         fetchInstances();
      } else {
         alert('Merge error: ' + result.error);
      }
    } catch (err: any) {
      alert('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <section id="dashboard" className="results-section animate-slide-up delay-200">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h2>Waste Tracker</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isMergeMode && (
               <button 
                 className="btn-roast" 
                 style={{ padding: '8px 16px' }}
                 onClick={executeMerge}
                 disabled={selectedForMerge.length < 2 || loading}
               >
                 {loading ? 'Merging...' : `Merge Selected (${selectedForMerge.length})`}
               </button>
            )}
            <button 
              className="btn-primary" 
              style={{ padding: '8px 16px', background: isMergeMode ? 'transparent' : 'var(--accent-primary)', border: isMergeMode ? '1px solid var(--accent-primary)' : 'none' }}
              onClick={() => {
                setIsMergeMode(!isMergeMode);
                setSelectedForMerge([]);
              }}
            >
              {isMergeMode ? 'Cancel Merge' : 'Enable Merge Mode'}
            </button>
          </div>
        </div>
        
        {isMergeMode && (
          <p className="text-muted" style={{ marginBottom: '20px' }}>
            Select multiple instances you want to combine. The <strong style={{color: 'var(--accent-primary)'}}>first one you click</strong> will be the container that keeps its date. Use this to clean up old 7-day events spread across multiple instances.
          </p>
        )}

        <div className="events-grid">
          {instances.length === 0 ? (
            <div className="glass-panel event-card">
              <div className="event-card-header">
                <h3>No Data</h3>
                <span className="badge">Info</span>
              </div>
              <p className="text-muted">No tracker instances found. Go to Import Data to add some.</p>
            </div>
          ) : (
            instances.map((instance) => (
              <EventCard 
                key={instance.id} 
                instance={instance} 
                isMergeMode={isMergeMode}
                isSelectedForMerge={selectedForMerge.includes(instance.id)}
                isPrimaryMerge={selectedForMerge[0] === instance.id}
                onToggleSelection={toggleMergeSelection}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
