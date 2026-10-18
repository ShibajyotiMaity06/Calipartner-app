import fs from 'fs';
import path from 'path';

const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
const fontRegex = /fontFamily\s*:\s*['"]([^'"]+)['"]/g;
const radiusRegex =
  /(border(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius)\s*:\s*(\d+(?:\.\d+)?)/g;
const shadowRegex = /(shadowRadius|elevation)\s*:\s*(\d+(?:\.\d+)?)/g;

function collectViolations(dir) {
  const violations = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', 'dist', 'coverage', 'assets'].includes(entry.name)) continue;
      violations.push(...collectViolations(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      const rel = path.relative('.', fullPath).replace(/\\/g, '/');
      if (
        rel.startsWith('packages/ui') ||
        rel.startsWith('packages/core') ||
        rel.includes('test') ||
        rel.includes('spec')
      ) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

        let m;
        // Hex colors
        hexRegex.lastIndex = 0;
        while ((m = hexRegex.exec(line)) !== null) {
          violations.push({
            file: rel,
            line: idx + 1,
            type: 'hex',
            matched: m[0],
          });
        }

        // Font family
        fontRegex.lastIndex = 0;
        while ((m = fontRegex.exec(line)) !== null) {
          violations.push({
            file: rel,
            line: idx + 1,
            type: 'fontFamily',
            matched: m[0],
          });
        }

        // Numeric radius
        radiusRegex.lastIndex = 0;
        while ((m = radiusRegex.exec(line)) !== null) {
          violations.push({
            file: rel,
            line: idx + 1,
            type: 'radius',
            matched: m[0],
          });
        }

        // Numeric shadow
        shadowRegex.lastIndex = 0;
        while ((m = shadowRegex.exec(line)) !== null) {
          violations.push({
            file: rel,
            line: idx + 1,
            type: 'shadow',
            matched: m[0],
          });
        }
      });
    }
  }

  return violations;
}

const baselinePath = path.resolve('docs/ui/baseline_violations.json');
const isGenerate = process.argv.includes('--generate');

const currentViolations = collectViolations('app/src');

if (isGenerate || !fs.existsSync(baselinePath)) {
  fs.writeFileSync(baselinePath, JSON.stringify(currentViolations, null, 2), 'utf8');
  console.log(
    `Saved baseline of ${currentViolations.length} existing style violations to docs/ui/baseline_violations.json`,
  );
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineKeySet = new Set(baseline.map((v) => `${v.file}:${v.type}:${v.matched}`));

const newViolations = currentViolations.filter(
  (v) => !baselineKeySet.has(`${v.file}:${v.type}:${v.matched}`),
);

if (newViolations.length > 0) {
  console.error(
    `\x1b[31m[ERROR] Found ${newViolations.length} NEW unapproved style violations outside packages/ui:\x1b[0m\n`,
  );
  for (const v of newViolations) {
    console.error(`  - ${v.file}:${v.line} [${v.type}] -> ${v.matched}`);
  }
  console.error(
    '\nRule U1 violation: Hard-coded hex colors, font names, and raw radii/shadows must be tokenized in packages/ui/tokens.',
  );
  process.exit(1);
} else {
  console.log(
    `\x1b[32m[PASS]\x1b[0m No new style violations detected (${currentViolations.length} grandfathered violations).`,
  );
  process.exit(0);
}
