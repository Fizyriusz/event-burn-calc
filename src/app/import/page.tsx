'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ImportPage() {
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
        event_templates(name, type)
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
        fetchInstances(); // odśwież aktywne instancje

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
    </div>
  );
}
