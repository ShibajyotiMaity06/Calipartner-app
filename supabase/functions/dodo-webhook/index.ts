import { handleDodoWebhook } from '../_shared/dodoHandlers.ts';
Deno.serve((req: Request) => handleDodoWebhook(req));
