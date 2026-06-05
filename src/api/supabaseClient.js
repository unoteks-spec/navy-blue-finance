import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mqzvbmvarlkaqzbgxxcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xenZibXZhcmxrYXF6Ymd4eGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODczNTUsImV4cCI6MjA5NjI2MzM1NX0.IGe3WUwR226AlBMr_im1ona7ZTiEqhvCgvVOXtZGmWA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
