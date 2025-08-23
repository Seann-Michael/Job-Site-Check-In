// Simple test to check environment variables in browser context
console.log('=== DEBUGGING ENV VARS ===');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('All VITE env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
console.log('Raw values check:');
console.log('URL truthy?', !!import.meta.env.VITE_SUPABASE_URL);
console.log('KEY truthy?', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('URL === placeholder?', import.meta.env.VITE_SUPABASE_URL === 'YOUR_ACTUAL_SUPABASE_PROJECT_URL');
console.log('KEY === placeholder?', import.meta.env.VITE_SUPABASE_ANON_KEY === 'YOUR_ACTUAL_SUPABASE_ANON_KEY');
console.log('==========================');
