'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function EventCard({ instance }: { instance: any }) {
  // Próba znalezienia odpowiedniego dnia
  const dayNumber = instance.leaderboard_entries?.[0]?.day_number || 0;
  
  // Pobieramy wszystkie dostępne konfiguracje (przeliczniki) dla tego eventu
  const pointConfigs = instance.event_templates?.event_point_configs || [];
  
  // Filtrujemy konfiguracje, które pasują do zadeklarowanego dnia (lub 0, jeśli to MINI)
  const availableConfigs = pointConfigs.filter((c: any) => c.day_number === dayNumber || c.day_number === 0);
  
  // Ustawiamy domyślny przelicznik (pierwszy z listy lub jakikolwiek jeśli lista dostępnych jest pusta, co nie powinno mieć miejsca)
  const initialConfig = availableConfigs.length > 0 ? availableConfigs[0] : pointConfigs[0] || { points_required: 1, item_name: 'Pkt', day_number: 0 };
  
  const [selectedConfig, setSelectedConfig] = useState<any>(initialConfig);

  // Dodatkowy efekt, gdy instancja ładuje się na nowo
  useEffect(() => {
    if (availableConfigs.length > 0 && (!selectedConfig || !availableConfigs.find((c: any) => c.id === selectedConfig.id))) {
      setSelectedConfig(availableConfigs[0]);
    }
  }, [availableConfigs, selectedConfig]);

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
  
  // Grupowanie punktów
  const alliancePoints: Record<string, number> = {};
  instance.leaderboard_entries.forEach((entry: any) => {
    const tag = entry.alliance_tag || 'N/A';
    alliancePoints[tag] = (alliancePoints[tag] || 0) + entry.score;
  });

  const sortedAlliances = Object.entries(alliancePoints)
    .sort((a, b) => b[1] - a[1]); // All alliances
    
  // Aktualny przelicznik z dropdownu
  const pointsPerItem = selectedConfig?.points_required || 1;
  const itemName = selectedConfig?.item_name || 'Pkt';

  return (
    <div className="glass-panel event-card">
      <div className="event-card-header">
        <h3>{instance.event_templates?.name || 'Unknown Event'}</h3>
        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-secondary)' }}>
          {instance.date}
        </span>
      </div>
      
      <div className="event-stats">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
          <label className="label" style={{ marginBottom: 0 }}>Convert to:</label>
          <select 
            className="input-field" 
            style={{ padding: '8px', fontSize: '0.9rem' }}
            value={selectedConfig?.id || ''} 
            onChange={(e) => {
              const cfg = pointConfigs.find((c: any) => c.id === e.target.value);
              if (cfg) setSelectedConfig(cfg);
            }}
          >
            {pointConfigs.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.item_name} (1 = {c.points_required} pts) {c.day_number > 0 ? `| Day: ${c.day_number}` : ''}
              </option>
            ))}
          </select>
        </div>

        <ul className="alliance-list">
          {sortedAlliances.map(([tag, score]) => (
            <li key={tag} className="alliance-item">
              <span className="alliance-tag">[{tag}]</span>
              <div className="alliance-score-details">
                <span className="score-raw">{Intl.NumberFormat('en-US').format(score)} pts</span>
                <span className="score-burn">≈ {Intl.NumberFormat('en-US').format(Math.floor(score / pointsPerItem))} burned ({itemName})</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="roast-module">
          <button 
            className="btn-roast" 
            onClick={() => {
               const topWhale = sortedAlliances[0];
               const roastText = `Alliance [${topWhale[0]}] complains about lack of preparation, but yesterday in [${instance.event_templates.name}] they burned the equivalent of ${Math.floor(topWhale[1] / pointsPerItem)} ${itemName}(s). Great job!`;
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
    // Pobieranie instancji wraz z powiązanymi danymi z leaderboards i konfiguracji
    const { data: instancesData } = await supabase
      .from('event_instances')
      .select(`
        *,
        event_templates(name, type, event_point_configs(*)),
        leaderboard_entries(score, alliance_tag, day_number)
      `)
      .order('date', { ascending: false });

    if (instancesData) {
      setInstances(instancesData);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleImport = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const parsedLeaderboard = JSON.parse(jsonInput);
      if (!Array.isArray(parsedLeaderboard)) throw new Error('JSON must be an array of player objects.');

      const payload = {
        event_template_id: selectedTemplateId,
        date: eventDate,
        day_number: selectedTemplate?.type === 'LONG' ? parseInt(dayNumber) : 0,
        leaderboard: parsedLeaderboard
      };

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
      } else {
        setMessage({ text: `API Error: ${data.error}`, type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: `JSON parsing error: ${e.message}`, type: 'error' });
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
            <div style={{ flex: '2 1 200px' }}>
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
            <div style={{ flex: '1 1 150px' }}>
              <label className="label">Event Date</label>
              <input 
                type="date" 
                className="input-field" 
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            {selectedTemplate?.type === 'LONG' && (
              <div style={{ flex: '1 1 100px' }}>
                <label className="label">Dzień (Day)</label>
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
