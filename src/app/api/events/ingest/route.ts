import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_template_id, date, day_number, leaderboard } = body;

    if (!event_template_id || !date || !Array.isArray(leaderboard)) {
      return NextResponse.json({ error: 'Missing required fields: event_template_id, date, or leaderboard array' }, { status: 400 });
    }

    // 1. Optional validation for template existence
    const { data: template, error: templateError } = await supabase
      .from('event_templates')
      .select('type')
      .eq('id', event_template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Event template isolated or not found' }, { status: 404 });
    }

    // 1. Check if instance already exists, if not, add it
    let instanceId: string = '';
    const { data: existingInstance, error: findError } = await supabase
      .from('event_instances')
      .select('id')
      .eq('event_template_id', event_template_id)
      .eq('date', date)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: `Database error viewing instance: ${findError.message}` },
        { status: 500 }
      );
    }

    if (existingInstance) {
      instanceId = existingInstance.id;
    }

    // 2. Jeśli dodajemy do instancji istniejacej, nie twórz nowej
    if (!existingInstance) {
      // Upewniamy się, że jeśli to event LONG, to day_number musi być poprawne (np. > 0)
      if (template.type === 'LONG' && (!day_number || day_number < 1)) {
         return NextResponse.json({ error: 'Long events require a specific day_number (> 0)' }, { status: 400 });
      }

      const { data: newInstance, error: createError } = await supabase
        .from('event_instances')
        .insert({
          event_template_id,
          date
        })
        .select()
        .single();
        
      if (createError || !newInstance) throw createError;
      instanceId = newInstance.id;
    }

    // 4. Transform leaderboard into entries for insertion, keeping day_number
    const entries = leaderboard.map((player: any) => {
      if (!player.player_name || !player.score) {
        throw new Error('Every player in the array must contain player_name and score');
      }
      return {
        event_instance_id: instanceId,
        day_number: template.type === 'MINI' ? 0 : day_number,
        player_name: player.player_name,
        alliance_tag: player.alliance_tag || null,
        score: Number(player.score),
      };
    });

    // 5. Insert leaderboard entries
    const { error: insertError } = await supabase
      .from('leaderboard_entries')
      .insert(entries);

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, instance_id: instanceId, inserted_count: entries.length });
  } catch (err: any) {
    console.error('Ingest Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
