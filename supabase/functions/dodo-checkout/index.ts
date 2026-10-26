import { handleDodoCheckout } from '../_shared/dodoHandlers.ts';
Deno.serve((req: Request) => handleDodoCheckout(req));
