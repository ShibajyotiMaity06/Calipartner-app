// Supabase "health" Edge Function. Public, no data access, no secrets.
// Contract mirrored by `HealthResponse` in packages/core.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const body = JSON.stringify({ status: 'ok', time: new Date().toISOString() });
  return new Response(body, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
