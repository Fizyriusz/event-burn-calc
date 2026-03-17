'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // States for importing / editing
  const [jsonInput, setJsonInput] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
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

  const handleEditClick = (tpl: any) => {
    const reconstructed = {
      name: tpl.name,
      type: tpl.type,
      configs: tpl.event_point_configs?.map((c: any) => ({
        day_number: c.day_number,
        item_name: c.item_name,
        points_required: c.points_required
      })) || []
    };
    
    setJsonInput(JSON.stringify(reconstructed, null, 2));
    setEditingTemplateId(tpl.id);
    setMessage({ text: `Editing Template: ${tpl.name}`, type: 'success' });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setJsonInput('');
    setEditingTemplateId(null);
    setMessage({ text: '', type: '' });
  };

  const handleJsonSubmit = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const parsedData = JSON.parse(jsonInput);

      if (!parsedData.name || !parsedData.type || !Array.isArray(parsedData.configs)) {
         throw new Error('Format JSON correctly. Required fields: name, type, configs (array).');
      }

      if (editingTemplateId) {
         // UPDATE
         const res = await fetch('/api/templates/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              template_id: editingTemplateId, ...parsedData 
            })
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error);
         
         setMessage({ text: 'Template updated successfully!', type: 'success' });
      } else {
         // INSERT
        const { data: templateData, error: templateError } = await supabase
          .from('event_templates')
          .insert({ name: parsedData.name, type: parsedData.type })
          .select()
          .single();

        if (templateError || !templateData) throw new Error(templateError?.message || 'Failed to create template');

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
      }

      setJsonInput('');
      setEditingTemplateId(null);
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
        <h2>{editingTemplateId ? 'Edit Event Template' : 'Express Template Import (JSON)'}</h2>
        <p className="text-muted">Use AI (e.g. Gemini) to parse an in-game screenshot or instructions into JSON format. Provide the calculated points required overall for items.</p>
        
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

          <div className="form-actions" style={{ gap: '16px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              disabled={loading || !jsonInput.trim()}
              onClick={handleJsonSubmit}
            >
              {loading ? 'Processing...' : (editingTemplateId ? 'Update Template' : 'Create Template')}
            </button>
            {editingTemplateId && (
              <button 
                type="button" 
                className="btn-roast"
                onClick={cancelEdit}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="results-section animate-slide-up delay-200">
        <div className="section-header">
          <h2>Saved Templates</h2>
          <span className="badge">Configured</span>
        </div>
        
        <div className="events-grid">
          {templates.length === 0 ? (
            <div className="glass-panel event-card">
              <p className="text-muted">No saved templates found.</p>
            </div>
          ) : (
            templates.map(tpl => (
              <div key={tpl.id} className="glass-panel event-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                   <button 
                     className="btn-roast" 
                     style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}
                     onClick={() => handleEditClick(tpl)}
                   >
                     Edit
                   </button>
                </div>
                <div className="event-card-header" style={{ alignItems: 'flex-start', paddingRight: '60px' }}>
                  <h3>{tpl.name}</h3>
                  <span className="badge">{tpl.type}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <p className="label">Conversion Rates:</p>
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {tpl.event_point_configs?.map((c: any) => (
                      <li key={c.id} style={{ marginBottom: '6px' }}>
                        {tpl.type === 'LONG' && c.day_number > 0 ? `Day ${c.day_number}: ` : ''}<strong style={{color: 'var(--text-primary)'}}>{c.item_name}</strong>
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
