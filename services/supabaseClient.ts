/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://gcpeiwucgeocfghwkscn.supabase.co';
// Clean any trailing /rest/v1 or trailing slash
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcGVpd3VjZ2VvY2ZnaHdrc2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTc3MTYsImV4cCI6MjEwNTE5MzcxNn0.SG7WofPedJcehC6jk863cQK4fBH7PRsk9_fCnKdZ6Ic';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
