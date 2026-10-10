import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DEV_100_FOOD_SEED } from '../packages/core/src/food_dataset';
import type { CreateFoodInput, FoodSource, ServingUnit } from '../packages/core/src/types';

/**
 * Escapes values for SQL string literals.
 */
function sqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

/**
 * Deterministically generates an RFC 4122 v4-formatted UUID from a namespace and key.
 * Ensures the exact same UUID is generated across runs and between Postgres & SQLite.
 */
export function deterministicUuid(namespace: string, key: string): string {
  const hash = crypto.createHash('md5').update(`${namespace}:${key}`).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = `4${hash.substring(13, 16)}`;
  const variantByte = (parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80;
  const part4 = `${variantByte.toString(16).padStart(2, '0')}${hash.substring(18, 20)}`;
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}

/**
 * Robust CSV parser that handles quoted strings, escaped quotes (""), and multiline cells.
 */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cur.trim());
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        row.push(cur.trim());
        if (row.some((cell) => cell.length > 0)) {
          rows.push(row);
        }
        row = [];
        cur = '';
      } else {
        cur += c;
      }
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Extracts key Indian regional aliases (Hindi, English, Tamil, Telugu, etc.)
 * and appends them to food names so multilingual searches match effortlessly.
 */
export function extractSmartName(name: string, rawAliases: string): string {
  if (!rawAliases) return name;
  const parts = rawAliases.split(';');
  const candidates: string[] = [];

  const prioritizedLangs = ['H.', 'E.', 'B.', 'Tam.', 'Tel.', 'Mar.', 'G.'];

  for (const lang of prioritizedLangs) {
    for (const part of parts) {
      if (part.includes(lang)) {
        const cleaned = part.replace(/^[A-Za-z.,\s]+?\.\s*/, '').trim();
        const sub = cleaned.split(',').map((s) => s.trim());
        for (const s of sub) {
          if (
            s &&
            s.length > 1 &&
            !candidates.some((c) => c.toLowerCase() === s.toLowerCase()) &&
            !name.toLowerCase().includes(s.toLowerCase())
          ) {
            candidates.push(s);
          }
        }
      }
    }
  }

  if (candidates.length < 3) {
    for (const part of parts) {
      const cleaned = part.replace(/^[A-Za-z.,\s]+?\.\s*/, '').trim();
      const sub = cleaned.split(',').map((s) => s.trim());
      for (const s of sub) {
        if (
          s &&
          s.length > 1 &&
          !candidates.some((c) => c.toLowerCase() === s.toLowerCase()) &&
          !name.toLowerCase().includes(s.toLowerCase())
        ) {
          candidates.push(s);
        }
      }
    }
  }

  const topAliases = candidates.slice(0, 3);
  if (topAliases.length === 0) return name;
  return `${name} (${topAliases.join(', ')})`;
}

/**
 * Loads and compiles the 3 datasets from the datasets directory:
 * 1. datasets/ingridients.csv (ICMR-NIN IFCT 2017)
 * 2. datasets/reciepes.csv (Curated Indian Recipes)
 * 3. datasets/barcode_products.csv (Open Food Facts Barcoded Products)
 */
export function loadDatasetsFromFolder(datasetsDir: string): CreateFoodInput[] {
  const foods: CreateFoodInput[] = [];

  // 1. Ingredients (IFCT 2017)
  const ingsPath = path.join(datasetsDir, 'ingridients.csv');
  if (fs.existsSync(ingsPath)) {
    const ingsContent = fs.readFileSync(ingsPath, 'utf8');
    const rows = parseCsvRows(ingsContent).slice(1);

    for (const r of rows) {
      const foodId = r[0]?.trim();
      if (!foodId) continue;

      const rawName = r[3]?.trim() || 'Unknown Food';
      const rawAliases = r[4]?.trim() || '';
      const name = extractSmartName(rawName, rawAliases);

      const calories = parseFloat(r[9] || '0') || 0;
      const protein = parseFloat(r[10] || '0') || 0;
      const fat = parseFloat(r[11] || '0') || 0;
      const carbs = parseFloat(r[12] || '0') || 0;
      const fiber = parseFloat(r[13] || '0') || 0;
      const sugar = parseFloat(r[15] || '0') || 0;
      const sodium = parseFloat(r[18] || '0') || 0;

      const defaultGrams = parseFloat(r[20] || '0') || 0;
      const defaultLabel = r[21]?.trim() || 'serving';

      const servingUnits: ServingUnit[] = [];
      if (defaultGrams > 0) {
        servingUnits.push({
          unit: defaultLabel,
          grams: defaultGrams,
          description: defaultLabel.includes('(') ? defaultLabel : `1 ${defaultLabel} (~${defaultGrams}g)`,
        });
      } else {
        servingUnits.push({
          unit: 'serving',
          grams: 100,
          description: '100g',
        });
      }
      servingUnits.push({ unit: 'g', grams: 1 });

      foods.push({
        id: deterministicUuid('ifct', foodId),
        source: 'ifct',
        name,
        brand: null,
        barcode: null,
        serving_units: servingUnits,
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
        fiber_per_100g: fiber,
        sugar_per_100g: sugar,
        sodium_mg_per_100g: sodium,
        owner_id: null,
        attribution: 'ICMR-NIN IFCT 2017',
      });
    }
  }

  // 2. Recipes (Curated Indian cooked recipes)
  const recsPath = path.join(datasetsDir, 'reciepes.csv');
  if (fs.existsSync(recsPath)) {
    const recsContent = fs.readFileSync(recsPath, 'utf8');
    const rows = parseCsvRows(recsContent).slice(1);

    for (const r of rows) {
      const recipeId = r[0]?.trim();
      if (!recipeId) continue;

      const rawName = r[1]?.trim() || 'Unknown Recipe';
      const aliases = r[2]?.trim();
      let name = rawName;
      if (aliases) {
        const primaryAlias = aliases.split(';')[0]?.trim();
        if (primaryAlias && !rawName.toLowerCase().includes(primaryAlias.toLowerCase())) {
          name = `${rawName} (${primaryAlias})`;
        }
      }

      const servingGrams = parseFloat(r[9] || '100') || 100;
      const calories = parseFloat(r[15] || '0') || 0;
      const protein = parseFloat(r[16] || '0') || 0;
      const fat = parseFloat(r[17] || '0') || 0;
      const carbs = parseFloat(r[18] || '0') || 0;
      const fiber = parseFloat(r[14] || '0') || 0;

      const servingUnits: ServingUnit[] = [
        {
          unit: 'serving',
          grams: servingGrams,
          description: `1 serving (~${servingGrams}g)`,
        },
        { unit: 'g', grams: 1 },
      ];

      foods.push({
        id: deterministicUuid('recipe', recipeId),
        source: 'ifct',
        name,
        brand: null,
        barcode: null,
        serving_units: servingUnits,
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
        fiber_per_100g: fiber,
        sugar_per_100g: 0,
        sodium_mg_per_100g: 0,
        owner_id: null,
        attribution: 'CaliPartner Indian Recipes',
      });
    }
  }

  // 3. Barcode Products (Open Food Facts)
  const barPath = path.join(datasetsDir, 'barcode_products.csv');
  if (fs.existsSync(barPath)) {
    const barContent = fs.readFileSync(barPath, 'utf8');
    const rows = parseCsvRows(barContent).slice(1);

    for (const r of rows) {
      const barcode = r[0]?.trim();
      const productName = r[1]?.trim();
      if (!barcode || !productName) continue;

      const brand = r[2]?.trim() || null;
      const servingSize = r[4]?.trim() || '';
      const servingG = parseFloat(r[5] || '0') || 0;

      const calories = parseFloat(r[6] || '0') || 0;
      const protein = parseFloat(r[7] || '0') || 0;
      const fat = parseFloat(r[8] || '0') || 0;
      const carbs = parseFloat(r[9] || '0') || 0;
      const fiber = parseFloat(r[10] || '0') || 0;
      const sugar = parseFloat(r[11] || '0') || 0;
      const sodium = parseFloat(r[12] || '0') || 0;

      const servingUnits: ServingUnit[] = [];
      if (servingG > 0) {
        servingUnits.push({
          unit: 'serving',
          grams: servingG,
          description: servingSize || `1 serving (~${servingG}g)`,
        });
      } else {
        servingUnits.push({
          unit: 'serving',
          grams: 100,
          description: '100g',
        });
      }
      servingUnits.push({ unit: 'g', grams: 1 });

      foods.push({
        id: deterministicUuid('barcode', barcode),
        source: 'off',
        name: productName,
        brand,
        barcode,
        serving_units: servingUnits,
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
        fiber_per_100g: fiber,
        sugar_per_100g: sugar,
        sodium_mg_per_100g: sodium,
        owner_id: null,
        attribution: 'Open Food Facts (ODbL)',
      });
    }
  }

  return foods;
}

/**
 * Serializes foods to CSV format.
 */
export function foodsToCsv(foods: readonly CreateFoodInput[]): string {
  const headers = [
    'id',
    'source',
    'name',
    'brand',
    'barcode',
    'calories_per_100g',
    'protein_per_100g',
    'carbs_per_100g',
    'fat_per_100g',
    'fiber_per_100g',
    'sugar_per_100g',
    'sodium_mg_per_100g',
    'serving_units_json',
    'attribution',
  ];

  const rows = foods.map((f) => {
    return [
      f.id ?? '',
      f.source ?? 'ifct',
      `"${(f.name ?? '').replace(/"/g, '""')}"`,
      f.brand ? `"${f.brand.replace(/"/g, '""')}"` : '',
      f.barcode ?? '',
      f.calories_per_100g,
      f.protein_per_100g,
      f.carbs_per_100g,
      f.fat_per_100g,
      f.fiber_per_100g ?? 0,
      f.sugar_per_100g ?? 0,
      f.sodium_mg_per_100g ?? 0,
      `"${JSON.stringify(f.serving_units ?? []).replace(/"/g, '""')}"`,
      f.attribution ? `"${f.attribution.replace(/"/g, '""')}"` : '',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates SQL insert statements for public.foods.
 */
export function foodsToSql(foods: readonly CreateFoodInput[]): string {
  const statements = foods.map((f) => {
    const idVal = f.id ? `'${f.id}'::uuid` : 'gen_random_uuid()';
    const unitsJson = sqlString(JSON.stringify(f.serving_units ?? []));
    return `INSERT INTO public.foods (
  id, source, name, brand, barcode, serving_units,
  calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
  owner_id, attribution
) VALUES (
  ${idVal},
  ${sqlString(f.source ?? 'ifct')},
  ${sqlString(f.name)},
  ${sqlString(f.brand)},
  ${sqlString(f.barcode)},
  ${unitsJson}::jsonb,
  ${f.calories_per_100g},
  ${f.protein_per_100g},
  ${f.carbs_per_100g},
  ${f.fat_per_100g},
  ${f.fiber_per_100g ?? 0},
  ${f.sugar_per_100g ?? 0},
  ${f.sodium_mg_per_100g ?? 0},
  NULL,
  ${sqlString(f.attribution)}
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  barcode = EXCLUDED.barcode,
  serving_units = EXCLUDED.serving_units,
  calories_per_100g = EXCLUDED.calories_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  fiber_per_100g = EXCLUDED.fiber_per_100g,
  sugar_per_100g = EXCLUDED.sugar_per_100g,
  sodium_mg_per_100g = EXCLUDED.sodium_mg_per_100g,
  attribution = EXCLUDED.attribution;`;
  });

  return `-- Pre-seeded global foods
BEGIN;
${statements.join('\n\n')}
COMMIT;
`;
}

/**
 * Builds the compact bundled SQLite food database for offline instant search.
 */
export function buildBundledSqliteDb(
  foods: readonly CreateFoodInput[],
  dbFilePath: string,
): void {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    fs.unlinkSync(dbFilePath);
  }

  const db = new DatabaseSync(dbFilePath);

  db.exec(`
    CREATE TABLE bundled_foods (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      serving_units TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      fiber_per_100g REAL NOT NULL DEFAULT 0,
      sugar_per_100g REAL NOT NULL DEFAULT 0,
      sodium_mg_per_100g REAL NOT NULL DEFAULT 0,
      attribution TEXT
    );
    CREATE INDEX idx_bundled_name ON bundled_foods (name);
    CREATE INDEX idx_bundled_barcode ON bundled_foods (barcode);
  `);

  db.exec('BEGIN TRANSACTION;');

  const insertStmt = db.prepare(`
    INSERT INTO bundled_foods (
      id, source, name, brand, barcode, serving_units,
      calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      fiber_per_100g, sugar_per_100g, sodium_mg_per_100g, attribution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const f of foods) {
    insertStmt.run(
      f.id ?? `food-${Math.random().toString(36).substring(2, 9)}`,
      f.source ?? 'ifct',
      f.name,
      f.brand ?? null,
      f.barcode ?? null,
      JSON.stringify(f.serving_units ?? []),
      f.calories_per_100g,
      f.protein_per_100g,
      f.carbs_per_100g,
      f.fat_per_100g,
      f.fiber_per_100g ?? 0,
      f.sugar_per_100g ?? 0,
      f.sodium_mg_per_100g ?? 0,
      f.attribution ?? null,
    );
  }

  db.exec('COMMIT;');
  db.close();
}

/**
 * Main execution handler when running from CLI.
 */
export function runFoodTools(args: string[] = process.argv.slice(2)): void {
  const rootDir = path.resolve(__dirname, '..');
  const supabaseDir = path.join(rootDir, 'supabase');
  const appAssetsDir = path.join(rootDir, 'app', 'assets');
  const datasetsDir = path.join(rootDir, 'datasets');

  let foodsToProcess: readonly CreateFoodInput[] = DEV_100_FOOD_SEED;

  if (fs.existsSync(datasetsDir)) {
    console.log(`[food_tools] Detected datasets folder at: ${datasetsDir}`);
    const compiled = loadDatasetsFromFolder(datasetsDir);
    if (compiled.length > 0) {
      foodsToProcess = compiled;
      console.log(`[food_tools] Successfully compiled ${foodsToProcess.length} foods from datasets folder!`);
    }
  }

  const importIndex = args.indexOf('--import');
  if (importIndex !== -1 && args[importIndex + 1]) {
    const csvPath = path.resolve(process.cwd(), args[importIndex + 1]!);
    console.log(`[food_tools] Reading custom CSV from: ${csvPath}`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCsvRows(content).slice(1);
    foodsToProcess = rows.map((r, i) => ({
      id: r[0] || deterministicUuid('custom', String(i)),
      source: (r[1] as FoodSource) || 'ifct',
      name: r[2] || 'Unknown Food',
      brand: r[3] || null,
      barcode: r[4] || null,
      calories_per_100g: parseFloat(r[5] || '0') || 0,
      protein_per_100g: parseFloat(r[6] || '0') || 0,
      carbs_per_100g: parseFloat(r[7] || '0') || 0,
      fat_per_100g: parseFloat(r[8] || '0') || 0,
      fiber_per_100g: parseFloat(r[9] || '0') || 0,
      sugar_per_100g: parseFloat(r[10] || '0') || 0,
      sodium_mg_per_100g: parseFloat(r[11] || '0') || 0,
      serving_units: [{ unit: 'g', grams: 1 }],
      attribution: r[13] || null,
    }));
    console.log(`[food_tools] Parsed ${foodsToProcess.length} foods from custom CSV`);
  }

  // 1. Export Supabase SQL seed
  const sqlContent = foodsToSql(foodsToProcess);
  const sqlPath = path.join(supabaseDir, 'seed_foods.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
  console.log(`[food_tools] Wrote SQL seed to: ${sqlPath}`);

  // 2. Export Supabase CSV seed
  const csvContent = foodsToCsv(foodsToProcess);
  const csvPath = path.join(supabaseDir, 'seed_foods.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`[food_tools] Wrote CSV seed to: ${csvPath}`);

  // 3. Export compact JSON for bundled offline asset
  if (!fs.existsSync(appAssetsDir)) {
    fs.mkdirSync(appAssetsDir, { recursive: true });
  }
  const jsonPath = path.join(appAssetsDir, 'bundled_foods.json');
  fs.writeFileSync(jsonPath, JSON.stringify(foodsToProcess, null, 2), 'utf-8');
  console.log(`[food_tools] Wrote bundled foods JSON to: ${jsonPath}`);

  // 4. Export compact SQLite database for instant offline search
  const sqlitePath = path.join(appAssetsDir, 'bundled_foods.db');
  buildBundledSqliteDb(foodsToProcess, sqlitePath);
  console.log(`[food_tools] Wrote bundled SQLite database to: ${sqlitePath}`);

  console.log(`[food_tools] Successfully generated all seed artifacts for ${foodsToProcess.length} foods!`);
}

if (require.main === module) {
  runFoodTools();
}
