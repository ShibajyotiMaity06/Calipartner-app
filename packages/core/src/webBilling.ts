import { PRICING_PLANS } from './subscriptions';
import type { DodoCatalogProduct, DodoProductKey } from './dodoBilling';

export const BILLING_COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

export function webBillingProvider(platform: string, country: unknown) {
  if (platform !== 'web') return 'revenuecat' as const;
  if (typeof country !== 'string' || !BILLING_COUNTRY_CODES.includes(country.trim().toUpperCase()))
    throw new Error('BILLING_COUNTRY_REQUIRED');
  return country.trim().toUpperCase() === 'IN' ? ('razorpay' as const) : ('dodo' as const);
}

export function verifiedRazorpayPlan(key: DodoProductKey, input: unknown): DodoCatalogProduct {
  const plan = input as {
    period?: string;
    interval?: number;
    item?: { currency?: string; amount?: number };
  } | null;
  const tier = key.startsWith('plus_') ? 'plus' : 'pro';
  const annual = key.endsWith('_annual');
  const price = PRICING_PLANS[tier];
  const amount = price.inr[annual ? 'rawAnnual' : 'rawMonthly'];
  if (
    plan?.period !== (annual ? 'yearly' : 'monthly') ||
    plan.interval !== 1 ||
    plan.item?.currency !== 'INR' ||
    plan.item.amount !== Math.round(amount * 100)
  )
    throw new Error('RAZORPAY_PLAN_MISMATCH');
  return { key, currency: 'INR', amount, trialDays: price.trialDays };
}

export function razorpayEpoch(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 1e11
    ? new Date(value * 1000).toISOString()
    : null;
}

export function isCapturedRazorpayInvoice(
  payment: Record<string, unknown>,
  invoice: Record<string, unknown>,
  product: DodoCatalogProduct,
): boolean {
  const amountMinor = Math.round(product.amount * 100);
  return (
    payment.status === 'captured' &&
    payment.currency === 'INR' &&
    Number(payment.amount) >= amountMinor &&
    Number(payment.amount_refunded) >= 0 &&
    Number(payment.amount_refunded) < Number(payment.amount) &&
    invoice.status === 'paid' &&
    invoice.currency === 'INR' &&
    Number(invoice.amount_paid) >= amountMinor
  );
}
