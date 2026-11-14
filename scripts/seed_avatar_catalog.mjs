import { readFile, writeFile } from 'node:fs/promises';

// Generate a new immutable migration when the versioned catalogue changes.
const seed = JSON.parse(await readFile('supabase/seed/avatar_catalog.json', 'utf8'));
const q = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const rows = Object.entries({ ...seed.config, starter_path: seed.starter_path }).map(
  ([key, value]) => `('${key}',${q(value)})`,
);
const sql =
  `-- Generated from supabase/seed/avatar_catalog.json. Prices can subsequently change server-side.\ninsert into public.avatar_config values ${rows.join(',\n')};\n` +
  seed.collections
    .map(
      (c) =>
        `insert into public.avatar_collections(id,name,tier_required,sort,earn_only,bundle_discount_pct) select id,name,tier_required,sort,earn_only,bundle_discount_pct from jsonb_populate_record(null::public.avatar_collections,${q(c)});`,
    )
    .join('\n') +
  '\n' +
  seed.products
    .map(
      (p) =>
        `insert into public.avatar_products(id,collection_id,definition,price_cc,active) values('${p.id}','${p.collection_id}',${q(p)},${p.price_cc},${p.active});`,
    )
    .join('\n') +
  '\n' +
  seed.tints
    .map(
      (t) =>
        `insert into public.avatar_tints select * from jsonb_populate_record(null::public.avatar_tints,${q(t)});`,
    )
    .join('\n') +
  '\n' +
  seed.levels
    .map((l) => `insert into public.avatar_levels values(${l.level},${l.xp_required},${l.form});`)
    .join('\n') +
  '\n' +
  seed.packs
    .map(
      (p) => `insert into public.cc_packs values('${p.id}','${p.store_product_id}',${p.cc},true);`,
    )
    .join('\n') +
  '\n' +
  seed.earn_rules
    .map(
      (r) =>
        `insert into public.cc_earn_rules values('${r.action}',${r.cc},${r.xp},${r.daily_cap},true);`,
    )
    .join('\n') +
  '\n' +
  `insert into public.challenge_config(key,value) values('avatar_rewards',${q(seed.challenge_rewards)});\n`;
await writeFile(process.argv[2] ?? 'supabase/migrations/20261113000200_avatar_catalog.sql', sql);
console.log(
  `Avatar catalogue: ${seed.products.length} products, ${seed.collections.length} collections, ${seed.tints.length} colors`,
);
