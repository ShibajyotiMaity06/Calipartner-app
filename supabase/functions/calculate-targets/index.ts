import {
  calculateTargets,
  type CalculateTargetsInput,
} from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleCalculateTargets(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CalculateTargetsInput;
    const result = calculateTargets(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response> | Response) => void;
    }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(handleCalculateTargets);
}
