import { handleRazorpayWebhook } from '../_shared/razorpayHandlers.ts';
if (import.meta.main) Deno.serve((req) => handleRazorpayWebhook(req));
