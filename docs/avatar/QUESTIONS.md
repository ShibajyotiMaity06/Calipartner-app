# Avatar decisions and external setup

## Resolved using the owner's request

- Keep the supplied CC prices and pack targets. Price additional premium accessories at 90–140 CC (Plus) / 180–220 CC (Pro), garments at 120–180 CC / 220–300 CC. Prices live in database catalogue/config, not screens.
- Preserve purchased cosmetics after expiry; free Starter Kit, previews and outfit color choice remain available. No subscription grants CC.
- Use the existing server entitlements and stored profile timezone, not a second tier or timezone source. Retired Focus earns nothing.
- Light is the new default. Yellow preserves the previous app palette. Home exposes all three choices.
- Original CSV prices and asset notes predate the current supplied implementation spec. Use the newer spec for collection access and CC pricing.

## Manual service configuration

- Create the five native consumables in App Store Connect / Google Play and a RevenueCat `cc` offering with matching product identifiers. Confirm available regional price points against the supplied targets. The UI displays store-localized prices only.
- Enable store server notifications and RevenueCat non-renewing purchase/refund webhook events. Native sandbox credit/refund validation requires configured store products and test accounts.
- Transparent base/skin preparation uses a deterministic build process. Review generated cutouts and skin masks before production art approval.

## Later work

Forms 4/5, monthly catalogue drops, sharing overlays and expanded female hairstyles remain later work; no placeholders are sold.
