import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'VND';

    const sb = getSupabase();
    const { data, error } = await sb
      .from('exchange_rates')
      .select('*')
      .eq('currency_code', currency)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Exchange rate not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        currency_code: data.currency_code,
        rate_to_krw: data.rate_to_krw,
        last_updated: data.last_updated,
        source: data.source,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
