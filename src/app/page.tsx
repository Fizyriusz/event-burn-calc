'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function EventCard({ instance }: { instance: any }) {
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
      <div className="glass-panel event-card">
        <div className="event-card-header">
          <h3>{instance.event_templates?.name || 'Unknown Event'}</h3>
          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-secondary)' }}>
            {instance.date}
          </span>
        </div>
        <p className="text-muted">No statistics available for this event.</p>
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
    <div className="glass-panel event-card">
      <div className="event-card-header">
        <h3>{instance.event_templates?.name || 'Unknown Event'}</h3>
        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-secondary)' }}>
          {instance.date}
        </span>
      </div>

      <div className="event-stats">
        {isLong && availableDays.length > 0 && (
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

        {viewDay !== 'ALL' && availableConfigs.length > 0 && (
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
                  onClick={() => toggleAlliance(tag)}
                >
                  <span className="alliance-tag">[{tag}] {isExpanded ? '▼' : '▶'}</span>
                  <div className="alliance-score-details" style={{ textAlign: 'right' }}>
                    <span className="score-raw">{Intl.NumberFormat('en-US').format(score)} pts</span>
                    <span className="score-burn">≈ {Intl.NumberFormat('en-US').format(burn)} burned ({itemName})</span>
                  </div>
                </div>

                {isExpanded && (
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
      </div>
    </div>
  );
}

export default function Home() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [importMode, setImportMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayNumber, setDayNumber] = useState('1');
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchTemplates();
    fetchInstances();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('event_templates').select('*, event_point_configs(*)').order('name');
    if (data) {
      setTemplates(data);
      if (data.length > 0) setSelectedTemplateId(data[0].id);
    }
  };

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

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const activeInstances = instances.filter(i => i.event_template_id === selectedTemplateId);

  const handleImport = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const parsedLeaderboard = JSON.parse(jsonInput);
      if (!Array.isArray(parsedLeaderboard)) throw new Error('JSON must be an array of player objects.');

      let currentDay = 0;
      if (selectedTemplate?.type === 'LONG') {
        currentDay = parseInt(dayNumber);
        if (isNaN(currentDay) || currentDay < 1) throw new Error('Invalid day number.');
      }

      const payload = {
        event_template_id: selectedTemplateId,
        date: importMode === 'NEW' ? eventDate : undefined,
        instance_id: importMode === 'EXISTING' ? selectedInstanceId : undefined,
        day_number: currentDay,
        leaderboard: parsedLeaderboard
      };

      if (importMode === 'EXISTING' && !selectedInstanceId) {
        throw new Error('Please select an active instance.');
      }

      const res = await fetch('/api/events/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: 'Success! Data imported successfully.', type: 'success' });
        setJsonInput('');
        fetchInstances(); // odśwież dashboard

        // Auto-switch to EXISTING mode after successful NEW creation for LONG events
        if (importMode === 'NEW' && selectedTemplate?.type === 'LONG') {
          setImportMode('EXISTING');
          if (data.instance_id) setSelectedInstanceId(data.instance_id);
        }
      } else {
        setMessage({ text: `API Error: ${data.error}`, type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: `Import error: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <section id="import" className="import-section glass-panel animate-slide-up delay-100">
        <h2>Add Results (Data Entry)</h2>
        <p className="text-muted">Select an Event Template and paste raw player results (JSON should be an array of players).</p>

        <form className="import-form">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="label">Event Template</label>
              <select
                className="input-field"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {templates.length === 0 && <option disabled value="">No templates found. Create one first.</option>}
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
            </div>

            {selectedTemplate?.type === 'LONG' && (
              <div style={{ flex: '1 1 150px' }}>
                <label className="label">Import Mode</label>
                <select
                  className="input-field"
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'NEW' | 'EXISTING')}
                >
                  <option value="NEW">Create New Instance</option>
                  <option value="EXISTING">Add to Active Instance</option>
                </select>
              </div>
            )}

            {selectedTemplate?.type === 'LONG' && importMode === 'EXISTING' && (
              <div style={{ flex: '1 1 200px' }}>
                <label className="label">Select Active Instance</label>
                <select
                  className="input-field"
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                >
                  <option value="" disabled>Select an active event instance...</option>
                  {activeInstances.map(i => (
                    <option key={i.id} value={i.id}>{i.event_templates?.name} ({i.date})</option>
                  ))}
                </select>
              </div>
            )}

            {(importMode === 'NEW' || selectedTemplate?.type === 'MINI') && (
              <div style={{ flex: '1 1 150px' }}>
                <label className="label">Event Start Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            )}

            {selectedTemplate?.type === 'LONG' && (
              <div style={{ flex: '1 1 100px' }}>
                <label className="label">Day Number</label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  className="input-field"
                  value={dayNumber}
                  onChange={(e) => setDayNumber(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label" htmlFor="json-input">Raw Leaderboard Array (JSON from OCR)</label>
            <textarea
              id="json-input"
              className="input-field"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[
  { "player_name": "Player1", "alliance_tag": "TAG", "score": 3639000 },
  { "player_name": "Player2", "alliance_tag": "TAG", "score": 1500000 }
]'
            ></textarea>
          </div>

          {message.text && (
            <div className={`form-message ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>
              {message.text}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleImport}
              disabled={loading || !jsonInput.trim() || templates.length === 0}
            >
              {loading ? 'Analyzing...' : 'Analyze Results'}
            </button>
          </div>
        </form>
      </section>

      <section id="dashboard" className="results-section animate-slide-up delay-200">
        <div className="section-header">
          <h2>Waste Tracker (Event Instances)</h2>
        </div>

        <div className="events-grid">
          {instances.length === 0 ? (
            <div className="glass-panel event-card">
              <div className="event-card-header">
                <h3>No Data</h3>
                <span className="badge">Info</span>
              </div>
              <p className="text-muted">Import some results first to see waste statistics.</p>
            </div>
          ) : (
            instances.map((instance) => (
              <EventCard key={instance.id} instance={instance} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
