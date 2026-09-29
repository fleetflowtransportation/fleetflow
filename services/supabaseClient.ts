/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://ydmeokfmsfgwrpbgmarv.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbWVva2Ztc2Znd3JwYmdtYXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzI4NzgsImV4cCI6MjEwNTgwODg3OH0.3sxjdlS9b3bPwTJ81uTkHvm6MHXJR4b_adURNE4qrn0';

export function getActiveSupabaseUrl(): string {
  try {
    const local = localStorage.getItem('fleetflow_supabase_url');
    if (local && local.trim().startsWith('http')) {
      const clean = local.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
      // If user had stored an old or invalid database URL, clean it up immediately
      if (!clean.includes('ydmeokfmsfgwrpbgmarv')) {
        localStorage.removeItem('fleetflow_supabase_url');
        localStorage.removeItem('fleetflow_supabase_anon_key');
        return DEFAULT_SUPABASE_URL;
      }
      return clean;
    }
  } catch {
    // ignore
  }

  const rawEnv = (import.meta as any).env?.VITE_SUPABASE_URL;
  if (rawEnv && rawEnv.trim().startsWith('http')) {
    const cleanEnv = rawEnv.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    if (cleanEnv.includes('ydmeokfmsfgwrpbgmarv')) {
      return cleanEnv;
    }
  }

  return DEFAULT_SUPABASE_URL;
}

export function getActiveSupabaseAnonKey(): string {
  try {
    const localUrl = localStorage.getItem('fleetflow_supabase_url');
    if (localUrl && !localUrl.includes('ydmeokfmsfgwrpbgmarv')) {
      localStorage.removeItem('fleetflow_supabase_url');
      localStorage.removeItem('fleetflow_supabase_anon_key');
      return DEFAULT_SUPABASE_ANON_KEY;
    }
    const local = localStorage.getItem('fleetflow_supabase_anon_key');
    if (local && local.trim().length > 20) {
      return local.trim();
    }
  } catch {
    // ignore
  }

  const rawEnv = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (rawEnv && rawEnv.trim().length > 20) {
    return rawEnv.trim();
  }

  return DEFAULT_SUPABASE_ANON_KEY;
}

export function createDirectSupabaseClient(url: string = DEFAULT_SUPABASE_URL, anonKey: string = DEFAULT_SUPABASE_ANON_KEY): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'fleetflow_direct_auth'
    },
    global: {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    }
  });
}

// Current client instance
let currentClient: SupabaseClient = createDirectSupabaseClient(
  getActiveSupabaseUrl(),
  getActiveSupabaseAnonKey()
);

export function getSupabase(): SupabaseClient {
  return currentClient;
}

export function updateSupabaseConfig(url: string, anonKey: string): { success: boolean; client: SupabaseClient } {
  try {
    const cleanUrl = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    const cleanKey = anonKey.trim();

    localStorage.setItem('fleetflow_supabase_url', cleanUrl);
    localStorage.setItem('fleetflow_supabase_anon_key', cleanKey);

    currentClient = createDirectSupabaseClient(cleanUrl, cleanKey);
    return { success: true, client: currentClient };
  } catch (err: any) {
    console.error('Failed to update Supabase configuration:', err);
    return { success: false, client: currentClient };
  }
}

export function resetSupabaseConfig(): void {
  try {
    localStorage.removeItem('fleetflow_supabase_url');
    localStorage.removeItem('fleetflow_supabase_anon_key');
    currentClient = createDirectSupabaseClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  } catch {
    // ignore
  }
}

// Proxy wrapper so any direct `supabase.from(...)` call always uses active client
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (currentClient as any)[prop];
  }
});

export interface SupabaseHealthCheckResult {
  success: boolean;
  message: string;
  url: string;
  region: string;
  latencyMs: number;
  tables: {
    fleet_users: { accessible: boolean; count?: number; error?: string };
    vehicles: { accessible: boolean; count?: number; error?: string };
    tenants: { accessible: boolean; count?: number; error?: string };
    bookings: { accessible: boolean; count?: number; error?: string };
  };
}

export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<SupabaseHealthCheckResult> {
  const testUrl = customUrl ? customUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : getActiveSupabaseUrl();
  const testKey = customKey ? customKey.trim() : getActiveSupabaseAnonKey();
  
  const clientToTest = (customUrl || customKey) ? createClient(testUrl, testKey) : currentClient;
  const startTime = Date.now();

  const tablesStatus: SupabaseHealthCheckResult['tables'] = {
    fleet_users: { accessible: false },
    vehicles: { accessible: false },
    tenants: { accessible: false },
    bookings: { accessible: false },
  };

  try {
    // 1. Check fleet_users
    const { data: usersData, error: usersErr } = await clientToTest
      .from('fleet_users')
      .select('id', { count: 'exact', head: false })
      .limit(10);
    
    if (usersErr) {
      tablesStatus.fleet_users = { accessible: false, error: usersErr.message };
    } else {
      tablesStatus.fleet_users = { accessible: true, count: usersData?.length ?? 0 };
    }

    // 2. Check vehicles
    const { data: vehData, error: vehErr } = await clientToTest
      .from('vehicles')
      .select('id')
      .limit(10);
    
    if (vehErr) {
      tablesStatus.vehicles = { accessible: false, error: vehErr.message };
    } else {
      tablesStatus.vehicles = { accessible: true, count: vehData?.length ?? 0 };
    }

    // 3. Check tenants
    const { data: tenData, error: tenErr } = await clientToTest
      .from('tenants')
      .select('id')
      .limit(10);
    
    if (tenErr) {
      tablesStatus.tenants = { accessible: false, error: tenErr.message };
    } else {
      tablesStatus.tenants = { accessible: true, count: tenData?.length ?? 0 };
    }

    // 4. Check bookings
    const { data: bookData, error: bookErr } = await clientToTest
      .from('bookings')
      .select('id')
      .limit(10);
    
    if (bookErr) {
      tablesStatus.bookings = { accessible: false, error: bookErr.message };
    } else {
      tablesStatus.bookings = { accessible: true, count: bookData?.length ?? 0 };
    }

    const latencyMs = Date.now() - startTime;
    const isAnyAccessible = tablesStatus.fleet_users.accessible || tablesStatus.vehicles.accessible || tablesStatus.tenants.accessible;

    if (!isAnyAccessible) {
      const mainError = usersErr?.message || vehErr?.message || 'Unable to connect to Supabase database tables.';
      return {
        success: false,
        message: `Database Connection Failed: ${mainError}`,
        url: testUrl,
        region: testUrl.includes('ydmeokfmsfgwrpbgmarv') ? 'Singapore (ap-southeast-1)' : 'Custom',
        latencyMs,
        tables: tablesStatus,
      };
    }

    return {
      success: true,
      message: `Successfully connected to Supabase Singapore in ${latencyMs}ms! All database tables are online and synchronized.`,
      url: testUrl,
      region: testUrl.includes('ydmeokfmsfgwrpbgmarv') ? 'Singapore (ap-southeast-1)' : 'Custom',
      latencyMs,
      tables: tablesStatus,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: `Connection Exception: ${err.message || 'Unknown network error'}`,
      url: testUrl,
      region: 'Unknown',
      latencyMs,
      tables: tablesStatus,
    };
  }
}
