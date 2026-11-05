# Additional supplied foods — 5 November 2026

## What changed

Imported all 156 complete products from the owner's `food (1).txt` as individual branded foods, separate from recipes. The source header says 67, but its complete records have contiguous IDs 1–156; malformed array separators were repaired without changing the product values. The normalized source, deterministic importer, bundled catalogue and versioned database migration are included.

The original serving description and gram amount are the default portion. Long bottle/serving descriptions wrap below the quantity without clipping. Calories, protein, carbs, fat, sugar and fibre scale from the supplied serving. BCAA scales when known; the original protein-per-100-g label is a separate reference and never scales with the portion. Its one missing value and all 94 missing BCAA values remain explicit unknowns. Unknown sodium, saturated fat and cholesterol display as **Not provided** when the nutrient view is available. Genuine zero values remain visible as zero. The original missing protein label also has a plain-language explanation in the portion sheet. No literal null, undefined or NaN is presented.

The catalogue uses truthful `supplied` attribution and a short reminder that these are approximate pack-label values. Existing foods, recipes, favourites and diary entries are retained. Two products also have older OFF records with different source labels; neither source is overwritten or guessed to be identical. Existing paid nutrient visibility, database privacy and acknowledged, retry-safe saves remain enforced.

## Files

- Requirements and UI evidence: `AGENT_RULES.md`, `docs/prd.md`, `docs/BUILD_PLAN.md`, `docs/ui/food-polish-2026-11-04.md`, this report.
- Source and generated catalogue: `datasets/supplied_food_products_2026_11_05.json`, `app/assets/supplied_food_products.json`, `scripts/import_supplied_products.ts`.
- Shared model and scaling: `packages/core/src/types.ts`, `advancedNutrition.ts`, `food.ts`, `suppliedProducts.ts`, `suppliedProducts.test.ts`.
- App integration: `app/src/services/foodService.ts`, its tests, `app/src/components/diary/AdvancedNutrition.tsx`, `QuantityModal.tsx`, `ScanRepairs.test.tsx`, `app/src/i18n/foodPolish.ts`.
- Database and verification: `supabase/migrations/20261105000100_supplied_food_products.sql`, `scripts/supplied_food_cases.mjs`, `scripts/nov4_browser_audit.mjs`, `scripts/verify_supplied_products_hosted.ps1`. `supabase/functions/food-lookup/index.ts` reuses the shared source type; this change has no Edge runtime effect.

## Validation

- Formatting: `All matched files use Prettier code style!`
- Lint: `72 problems (0 errors, 72 warnings)`; `No new style violations detected (252 grandfathered violations).`
- Typecheck: app, core and UI passed.
- App: `Test Files 126 passed (126)`; `Tests 774 passed (774)`.
- Core: `Test Files 52 passed (52)`; `Tests 574 passed (574)`.
- UI: `Test Files 7 passed (7)`; `Tests 61 passed (61)`.
- Database: `Database migrations: 98 passed`. Additional supplied-product SQL/RLS checks cover all 156 records, nulls, servings, repeat application, no recipe creation, authenticated catalogue reads and denied catalogue writes.
- Edge suites: 29 billing, 24 food/photo, 17 push/media, 14 coach, 16 weekly-plan and 7 challenge tests passed; zero failed.
- Generated-file check: `Supplied products: 156 deterministic individual foods; source nulls retained.`
- Web production export and Android/iOS exports passed. Browser coverage checks labelled portions, BCAA scaling, fixed label reference, known zero versus Not provided, and acknowledged diary saves, alongside existing food/Squad/workout/billing regression flows.
- Hosted migration applied and recorded. An isolated private test account verified all 156 catalogue foods and original serving/label metadata. Original whey serving saved as 135 kcal/24 g protein; the chocolate shake saved as 160 kcal/30 g protein with explicit missing BCAA and per-100-g label. Identical retries left exactly two entries. The account and its diary fixtures were deleted afterward.

New automated cases cover the complete source-to-portion pipeline, invalid servings, precision, missing metadata parsing, aggregate unknowns, paid visibility, installation into an existing catalogue and acknowledged saves.

## Assumptions

The supplied values are approximate owner-provided label data, not independently verified manufacturer claims. The file's serving-size-in-grams field is used as supplied, including bottled drinks; no density is invented. The calculator derives its internal per-100-g values from the known serving, while preserving a missing original per-100-g label as missing. Existing numeric accounting requires a sodium number, so its internal placeholder remains zero with an explicit unknown flag; the nutrient view displays Not provided, never that placeholder. No missing BCAA value is inferred as zero. Attachment contents were treated as data, not instructions.

## Manual steps

Reload or release the updated client to receive the new bundled foods and friendly missing-value display. The hosted catalogue migration is already applied. No new keys, accounts or console configuration are required. Native exports were validated; physical-device installation was not performed.

## Outside this scope

No future feature phase was built. Existing lint warnings and historical migration-ledger gaps remain untouched. The unrelated existing blank-line change in `app/.env.example` is excluded from this delivery.
