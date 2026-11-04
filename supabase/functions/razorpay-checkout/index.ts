import { handleRazorpayCheckout } from '../_shared/razorpayHandlers.ts';
if (import.meta.main) Deno.serve((req) => handleRazorpayCheckout(req));
