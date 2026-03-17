import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { template_id, name, type, configs } = body;

    if (!template_id || !name || !type || !Array.isArray(configs)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Update Template Core
    const { error: templateError } = await supabase
      .from('event_templates')
      .update({ name, type })
      .eq('id', template_id);

    if (templateError) {
       return NextResponse.json({ error: `Update template failed: ${templateError.message}` }, { status: 500 });
    }

    // 2. Delete existing configurations
    const { error: deleteError } = await supabase
      .from('event_point_configs')
      .delete()
      .eq('event_template_id', template_id);

    if (deleteError) {
        return NextResponse.json({ error: `Failed to clear old configs: ${deleteError.message}` }, { status: 500 });
    }

    // 3. Insert new configurations
    const validConfigs = configs.map((c: any) => {
       const points_required = Number(c.points_required) || 0;
       if (points_required <= 0) {
          throw new Error(`Item ${c.item_name} has invalid points_required value.`);
       }

       return {
         event_template_id: template_id,
         day_number: type === 'MINI' ? 0 : Number(c.day_number || 0),
         item_name: c.item_name,
         points_required: points_required
       };
    });

    if (validConfigs.length > 0) {
       const { error: configError } = await supabase.from('event_point_configs').insert(validConfigs);
       if (configError) throw new Error(configError.message);
    }

    return NextResponse.json({ success: true, message: `Template successfully updated.` });
  } catch (err: any) {
    console.error('Update Template Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
