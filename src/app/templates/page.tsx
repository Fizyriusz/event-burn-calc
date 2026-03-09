'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('event_templates')
      .select('*, event_point_configs(*)')
      .order('created_at', { ascending: false });
    
    if (data) setTemplates(data);
  };

  const handleJsonImport = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const parsedData = JSON.parse(jsonInput);

      if (!parsedData.name || !parsedData.type || !Array.isArray(parsedData.configs)) {
         throw new Error('Format JSON correctly. Required fields: name, type, configs (array).');
      }

      // 1. Insert Template
      const { data: templateData, error: templateError } = await supabase
        .from('event_templates')
        .insert({ name: parsedData.name, type: parsedData.type })
        .select()
        .single();

      if (templateError || !templateData) throw new Error(templateError?.message || 'Failed to create template');

      // 2. Insert Configs without multipliers
      const validConfigs = parsedData.configs.map((c: any) => {
        const points_required = Number(c.points_required) || 0;

        if (points_required <= 0) {
           throw new Error(`Item ${c.item_name} has invalid points_required value.`);
        }

        return {
          event_template_id: templateData.id,
          day_number: parsedData.type === 'MINI' ? 0 : Number(c.day_number || 0),
          item_name: c.item_name,
          points_required: points_required
        };
      });

      if (validConfigs.length > 0) {
        const { error: configError } = await supabase.from('event_point_configs').insert(validConfigs);
        if (configError) throw new Error(configError.message);
      }

      setMessage({ text: 'Template imported successfully!', type: 'success' });
      setJsonInput('');
      fetchTemplates();
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <section className="glass-panel animate-slide-up delay-100">
        <h2>Express Template Import (JSON)</h2>
        <p className="text-muted">Use AI (e.g. Gemini) to parse an in-game screenshot or instructions into JSON format. Provide the calculated points required overal for items.</p>
        
        <form className="import-form">
          <label className="label">JSON Template from OCR</label>
          <textarea 
            className="input-field" 
            style={{ fontFamily: 'monospace', minHeight: '260px' }}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{
  "name": "King of Ice",
  "type": "MINI",
  "configs": [
    { 
      "day_number": 1, 
      "item_name": "Governor Charm", 
      "points_required": 70
    },
    { 
      "day_number": 1, 
      "item_name": "Forgehammer", 
      "points_required": 6000
    }
  ]
}'
          />
          
          {message.text && (
            <div className={`form-message ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>
              {message.text}
            </div>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-primary" 
              disabled={loading || !jsonInput.trim()}
              onClick={handleJsonImport}
            >
              {loading ? 'Processing...' : 'Create Template'}
            </button>
          </div>
        </form>
      </section>

      <section className="results-section animate-slide-up delay-200">
        <div className="section-header">
          <h2>Saved Templates</h2>
        </div>
        
        <div className="events-grid">
          {templates.length === 0 ? (
            <div className="glass-panel event-card">
              <p className="text-muted">No saved templates found.</p>
            </div>
          ) : (
            templates.map(tpl => (
              <div key={tpl.id} className="glass-panel event-card">
                <div className="event-card-header">
                  <h3>{tpl.name}</h3>
                  <span className="badge">{tpl.type}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <p className="label">Conversion Rates:</p>
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {tpl.event_point_configs?.map((c: any) => (
                      <li key={c.id} style={{ marginBottom: '6px' }}>
                        {tpl.type === 'LONG' ? `Day ${c.day_number}: ` : ''}<strong style={{color: 'var(--text-primary)'}}>{c.item_name}</strong>
                        <br/>
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, color: 'var(--accent-primary)' }}>
                          {c.points_required} pts
                        </span>
                      </li>
                    ))}
                    {(!tpl.event_point_configs || tpl.event_point_configs.length === 0) && <li>None</li>}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
