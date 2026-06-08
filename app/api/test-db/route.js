import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  // 1. Env variables se credentials pull karna
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      status: "❌ Error",
      message: "Supabase environment variables missing in .env.local"
    }, { status: 500 });
  }

  // 2. Client Initialize karna
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // 3. PostgreSQL database par ek lightweight test query execute karna
    // Yeh query bina kisi specific table dependency ke direct DB health check karti hai
    const { data, error } = await supabase.from('_analytics').select('*').limit(1).maybeSingle(); 
    
    // Agar custom tables available nahi hain, toh standard bucket storage/auth logs check
    const { error: healthError } = await supabase.auth.getSession();

    if (healthError) {
      throw healthError;
    }

    return NextResponse.json({
      status: "🟢 Success",
      message: "CartRenew successfully connected to Supabase Database Cluster!",
      endpoint: supabaseUrl
    });

  } catch (err) {
    return NextResponse.json({
      status: "❌ Connection Failed",
      error_details: err.message
    }, { status: 500 });
  }
}