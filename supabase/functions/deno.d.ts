/**
 * Global Deno runtime declarations for Supabase Edge Functions.
 * This provides editor and TypeScript support for `Deno.env` and `Deno.serve`.
 */
declare namespace Deno {
  export const env: {
    get: (key: string) => string | undefined;
    set?: (key: string, value: string) => void;
  };
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}
