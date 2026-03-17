import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { primary_instance_id, instance_ids_to_merge } = body;

    if (!primary_instance_id || !Array.isArray(instance_ids_to_merge) || instance_ids_to_merge.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: primary_instance_id or instance_ids_to_merge array' }, { status: 400 });
    }

    // 1. Update all leaderboard entries pointing to the merged instances to point to the primary instead
    const { error: updateError } = await supabase
      .from('leaderboard_entries')
      .update({ event_instance_id: primary_instance_id })
      .in('event_instance_id', instance_ids_to_merge);

    if (updateError) {
       return NextResponse.json({ error: `Update leaderboard entries failed: ${updateError.message}` }, { status: 500 });
    }

    // 2. Delete the old instances
    const { error: deleteError } = await supabase
      .from('event_instances')
      .delete()
      .in('id', instance_ids_to_merge);

    if (deleteError) {
        return NextResponse.json({ error: `Delete orphaned instances failed: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Successfully merged ${instance_ids_to_merge.length} instances into ${primary_instance_id}` });
  } catch (err: any) {
    console.error('Merge Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
