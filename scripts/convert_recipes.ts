import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(cell.trim());
      cell = '';
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        lines.push(row);
      }
      row = [];
    } else {
      cell += c;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    lines.push(row);
  }

  return lines;
}

function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildFullBundledRecipes(): void {
  const csvPath = path.resolve(__dirname, '../datasets/reciepes.csv');
  const outPath = path.resolve(__dirname, '../app/assets/bundled_recipes.json');

  if (!fs.existsSync(csvPath)) {
    console.error('reciepes.csv not found at', csvPath);
    return;
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log(`Parsed ${dataRows.length} recipes from reciepes.csv`);

  const results: any[] = [];

  for (const r of dataRows) {
    if (!r[1]) continue;

    const id = `recipe-${r[0] ? r[0].toLowerCase() : generateSlug(r[1])}`;
    const name = r[1];
    const aliases = r[2] || '';
    const mealType = (r[3] || 'main').toLowerCase();
    const region = r[4] || 'Indian';
    const diet = (r[5] || 'veg').toLowerCase();
    const isVegan = r[6] === '1';
    const tagsRaw = r[7] || '';
    const servings = parseInt(r[8], 10) || 2;
    const servingG = parseFloat(r[9]) || 200;
    const cal = parseFloat(r[10]) || 0;
    const protein = parseFloat(r[11]) || 0;
    const fat = parseFloat(r[12]) || 0;
    const carbs = parseFloat(r[13]) || 0;
    const fiber = parseFloat(r[14]) || 0;
    const ingredientsText = r[22] || '';

    const dietTags = new Set<string>();
    if (isVegan) dietTags.add('vegan');
    if (diet === 'veg') dietTags.add('vegetarian');
    if (diet === 'egg') {
      dietTags.add('eggetarian');
      dietTags.add('high-protein');
    }
    if (diet === 'non-veg') dietTags.add('non-vegetarian');
    if (protein >= 15) dietTags.add('high-protein');
    if (cal <= 250) dietTags.add('low-calorie');

    if (tagsRaw) {
      tagsRaw.split(/\s+/).forEach((t) => {
        if (t.trim()) dietTags.add(t.trim().toLowerCase());
      });
    }

    // Parse ingredientsText, e.g. "Wheat flour, atta 70g; Paneer 50g; Sunflower oil 10g"
    const ingredients: any[] = [];
    if (ingredientsText) {
      const parts = ingredientsText.split(';');
      let order = 0;
      for (const p of parts) {
        const trimmed = p.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
        if (match) {
          ingredients.push({
            food_id: `f-${generateSlug(match[1])}`,
            food_name: match[1].trim(),
            quantity: parseFloat(match[2]),
            unit: match[3] || 'g',
            note: `${match[1].trim()} (${match[2]}${match[3] || 'g'})`,
            display_order: order++,
          });
        } else {
          ingredients.push({
            food_id: `f-${generateSlug(trimmed)}`,
            food_name: trimmed,
            quantity: 1,
            unit: 'serving',
            note: trimmed,
            display_order: order++,
          });
        }
      }
    }

    const steps = [
      `Prepare ingredients: measure ${ingredients.length} items as listed.`,
      `Heat pan/cooker, add oil/ghee and temper whole spices until aromatic.`,
      `Add main base ingredients (${name}) and sauté on medium heat until cooked thoroughly.`,
      `Simmer for 8-10 minutes to allow flavours to meld, season to taste, and serve hot.`,
    ];

    const tips = [
      aliases ? `Also known as: ${aliases}.` : `Best paired with phulkas, brown rice, or side salad.`,
      `Each serving is approximately ${servingG}g with ${protein}g protein.`,
    ];

    results.push({
      id,
      title: name,
      description: aliases
        ? `${name} (${aliases}). Wholesome ${region} preparation rich in balanced nutrients.`
        : `Wholesome ${region} style ${name} prepared with fresh ingredients.`,
      cuisine: region,
      diet_tags: Array.from(dietTags),
      meal_type: mealType === 'main' ? 'lunch' : mealType,
      prep_minutes: 10,
      cook_minutes: 20,
      difficulty: 'easy',
      servings,
      steps,
      tips,
      image_urls: [],
      status: 'published',
      nutrition_per_serving: {
        calories: cal,
        protein,
        carbs,
        fat,
        fiber,
        sugar: 2.0,
        sodium_mg: 120,
      },
      nutrition_override_reason: null,
      version: 1,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
      ingredients,
    });
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Successfully generated ${results.length} bundled recipes into ${outPath}`);
}

buildFullBundledRecipes();
