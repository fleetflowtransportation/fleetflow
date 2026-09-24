/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ydmeokfmsfgwrpbgmarv.supabase.co';
// Clean any trailing /rest/v1 or trailing slash
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbWVva2Ztc2Znd3JwYmdtYXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzI4NzgsImV4cCI6MjEwNTgwODg3OH0.3sxjdlS9b3bPwTJ81uTkHvm6MHXJR4b_adURNE4qrn0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
