// Serves public Supabase config to the browser.
// The anon key is safe to expose — it's restricted by RLS.
// This avoids hardcoding project-specific values in index.html.

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      supabaseUrl:      process.env.SUPABASE_URL      || '',
      supabaseAnonKey:  process.env.SUPABASE_ANON_KEY || '',
    }),
  };
};
